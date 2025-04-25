// bridge.js - Communication bridge between content script and service worker
// This file provides utility functions for the content script to interact with the service worker

console.log('[Bridge] Loaded bridge module for content script communication');

/**
 * Communication bridge between content script and extension components
 */
const Bridge = {
  /**
   * Send a message to the service worker
   * @param {Object} message - Message to send
   * @returns {Promise} Promise resolved with the response
   */
  sendToServiceWorker: function(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          console.error('[Bridge] Error sending message to service worker:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
          return;
        }
        
        resolve(response);
      });
    });
  },
  
  /**
   * Save recording data to the service worker
   * @param {Object} data - Recording data including blob, metadata, etc.
   * @returns {Promise} Promise resolved with save result
   */
  saveRecording: function(data) {
    console.log('[Bridge] Saving recording with metadata:', data);
    
    return this.sendToServiceWorker({
      action: 'saveRecording',
      data: data
    });
  },
  
  /**
   * Send a notification to any open extension popup
   * @param {Object} data - Notification data
   */
  notifyPopup: function(data) {
    console.log('[Bridge] Notifying popup:', data);
    
    chrome.runtime.sendMessage({
      action: 'notifyPopup',
      data: data
    });
  }
};

// Expose the bridge to the global scope for the content script
window.Bridge = Bridge;
