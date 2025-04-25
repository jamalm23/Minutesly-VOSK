// popup.js - Bridge file to maintain backward compatibility
// This file loads the modular architecture while preserving global functions

// Import our modules (this is immediately executed)
import * as RecordingController from './modules/recording-controller.js';
import * as UIManager from './modules/ui-manager.js';
import * as RecordingsList from './modules/recordings-list.js';
import * as TranscriptionViewer from './modules/transcription-viewer.js';
import * as Playback from './modules/playback.js';

// Expose key functions to the global scope for backward compatibility
window.updateRecordingState = RecordingController.updateRecordingState;
window.setSource = RecordingController.setSource;
window.updateDuration = RecordingController.updateDuration;
window.formatDuration = RecordingController.formatDuration;
window.startRecording = RecordingController.startRecording;
window.pauseRecording = RecordingController.pauseRecording;
window.resumeRecording = RecordingController.resumeRecording;
window.stopRecording = RecordingController.stopRecording;
window.sendToContentScript = RecordingController.sendToContentScript;
window.createEmergencyRecording = RecordingController.createEmergencyRecording;

window.showMainPanel = UIManager.showMainPanel;
window.showRecordingsPanel = UIManager.showRecordingsPanel;
window.showError = UIManager.showError;
window.openDashboard = UIManager.openDashboard;
window.openWhisperTest = UIManager.openWhisperTest;
window.openTranscriptionTest = UIManager.openTranscriptionTest;
window.closePopupWindow = UIManager.closePopupWindow;

window.loadAndDisplayRecordings = RecordingsList.loadAndDisplayRecordings;
window.renderRecordingsList = RecordingsList.renderRecordingsList;
window.handleRecordingActionClick = RecordingsList.handleRecordingActionClick;
window.applyFiltersAndRender = RecordingsList.applyFiltersAndRender;
window.filterRecordings = RecordingsList.filterRecordings;

window.playRecording = Playback.playRecording;
window.showTranscription = TranscriptionViewer.showTranscription;
window.deleteRecording = TranscriptionViewer.deleteRecording;

// Setup additional message handling to ensure events are properly processed
window.addEventListener('message', function(event) {
  console.log('[Bridge] Received window message:', event.data);
  
  // Forward recording-related events to the recording controller
  if (event.data && event.data.action) {
    switch (event.data.action) {
      case 'recordingStarted':
        RecordingController.updateRecordingState(RecordingController.RECORDING_STATES.RECORDING);
        break;
      case 'recordingPaused':
        RecordingController.updateRecordingState(RecordingController.RECORDING_STATES.PAUSED);
        break;
      case 'recordingStopped':
      case 'recordingCompleted':
        RecordingController.handleRecordingCompleted(event.data);
        break;
      case 'recordingError':
        UIManager.showError(event.data.error || 'Recording error occurred');
        RecordingController.updateRecordingState(RecordingController.RECORDING_STATES.INACTIVE);
        break;
    }
  }
});

// Add Chrome runtime message listener to ensure messages from background are handled
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Bridge] Received runtime message:', message);
  
  if (message.action === 'recordingCompleted') {
    RecordingController.handleRecordingCompleted(message.data);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'updateRecordingState') {
    RecordingController.updateRecordingState(message.state);
    sendResponse({ success: true });
    return true;
  }
  
  // Required for async response
  return true;
});

// This file no longer needs to initialize anything itself
// The modules/main.js file handles all initialization
console.log('popup.js bridge file loaded - using modular architecture');