// playback.js - Handles audio playback functionality
// Part of the modularization effort to comply with file size limits (Rule III.4)

/**
 * Playback module for audio recordings
 * Manages audio player and recording playback
 */

// References to DOM elements
let elements = {
  audioPlayer: null
};

/**
 * Initialize playback manager with DOM elements
 * @param {Object} domElements - Object containing DOM elements
 */
function initialize(domElements) {
  elements = {
    audioPlayer: domElements.audioPlayer
  };
  
  // Setup any additional event listeners for the audio player
  if (elements.audioPlayer) {
    elements.audioPlayer.addEventListener('error', (e) => {
      console.error('Audio player error:', e);
    });
  }
}

/**
 * Play a recording by its ID
 * @param {string} recordingId - ID of the recording to play
 */
function playRecording(recordingId) {
  console.log('Play recording requested:', recordingId);
  
  if (!elements.audioPlayer) {
    console.error('Audio player element not found');
    return;
  }
  
  // Show loading state
  elements.audioPlayer.parentElement.classList.add('loading');
  
  // Request audio data URL from background
  chrome.runtime.sendMessage({
    action: 'getRecordingBlob',
    id: recordingId,
    recordingId: recordingId
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting recording blob:', chrome.runtime.lastError);
      elements.audioPlayer.parentElement.classList.remove('loading');
      return;
    }
    
    if (!response || !response.dataUrl) {
      console.error('Invalid response from background:', response);
      elements.audioPlayer.parentElement.classList.remove('loading');
      return;
    }
    
    console.log('Received audio data URL');
    
    // Set audio source
    elements.audioPlayer.src = response.dataUrl;
    
    // Start playing
    elements.audioPlayer.play()
      .then(() => {
        console.log('Audio playback started');
        elements.audioPlayer.parentElement.classList.remove('loading');
      })
      .catch(err => {
        console.error('Failed to play audio:', err);
        elements.audioPlayer.parentElement.classList.remove('loading');
      });
  });
}

/**
 * Stop current playback
 */
function stopPlayback() {
  if (elements.audioPlayer) {
    elements.audioPlayer.pause();
    elements.audioPlayer.currentTime = 0;
  }
}

/**
 * Toggle playback (play/pause)
 */
function togglePlayback() {
  if (!elements.audioPlayer) return;
  
  if (elements.audioPlayer.paused) {
    elements.audioPlayer.play();
  } else {
    elements.audioPlayer.pause();
  }
}

/**
 * Set the audio volume
 * @param {number} volume - Volume level (0-1)
 */
function setVolume(volume) {
  if (elements.audioPlayer) {
    elements.audioPlayer.volume = Math.max(0, Math.min(1, volume));
  }
}

// Export public API
export {
  initialize,
  playRecording,
  stopPlayback,
  togglePlayback,
  setVolume
};
