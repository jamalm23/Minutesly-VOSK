// transcription-viewer.js - Handles displaying transcription content
// Part of the modularization effort to comply with file size limits (Rule III.4)

/**
 * Transcription viewer module
 * Manages transcription display and related operations
 */

// References to DOM elements and modal elements we'll create
let elements = {
  modalContainer: null
};

/**
 * Initialize transcription viewer
 */
function initialize() {
  // We'll create the modal container on demand
  setupModalContainer();
}

/**
 * Create modal container if it doesn't exist
 */
function setupModalContainer() {
  if (elements.modalContainer) return;
  
  // Create modal container
  elements.modalContainer = document.createElement('div');
  elements.modalContainer.className = 'modal-container hidden';
  elements.modalContainer.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">Transcription</h3>
        <button class="modal-close-button">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="transcription-content"></div>
      </div>
    </div>
  `;
  
  // Add event listeners
  const overlay = elements.modalContainer.querySelector('.modal-overlay');
  const closeButton = elements.modalContainer.querySelector('.modal-close-button');
  
  overlay.addEventListener('click', hideTranscription);
  closeButton.addEventListener('click', hideTranscription);
  
  // Add to document
  document.body.appendChild(elements.modalContainer);
}

/**
 * Show transcription content in a modal
 * @param {string} recordingId - ID of the recording to show transcription for
 */
function showTranscription(recordingId) {
  // Make sure modal container is set up
  setupModalContainer();
  
  console.log('Showing transcription for recording:', recordingId);
  
  // Show loading state
  elements.modalContainer.classList.remove('hidden');
  const contentElement = elements.modalContainer.querySelector('.transcription-content');
  const titleElement = elements.modalContainer.querySelector('.modal-title');
  
  contentElement.innerHTML = '<div class="loading-spinner"></div><div>Loading transcription...</div>';
  titleElement.textContent = 'Transcription';
  
  // Request transcription from background
  chrome.runtime.sendMessage({
    action: 'getRecordingDetails',
    recordingId: recordingId
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting recording details:', chrome.runtime.lastError);
      contentElement.textContent = 'Error loading transcription: ' + chrome.runtime.lastError.message;
      return;
    }
    
    if (!response || !response.recording) {
      console.error('Invalid response from background:', response);
      contentElement.textContent = 'Error: Could not load recording details';
      return;
    }
    
    const recording = response.recording;
    
    // Update title with recording info
    if (recording.title) {
      titleElement.textContent = recording.title;
    }
    
    // Display transcription content or placeholder
    if (recording.transcription && recording.transcription.trim()) {
      // Format paragraphs
      const formattedTranscription = recording.transcription
        .split('\n')
        .map(para => para.trim())
        .filter(para => para.length > 0)
        .map(para => `<p>${para}</p>`)
        .join('');
      
      contentElement.innerHTML = formattedTranscription;
    } else {
      contentElement.innerHTML = '<p class="no-transcription">No transcription available for this recording.</p>';
    }
    
    // Add metadata if available
    if (recording.timestamp || recording.duration) {
      const metadataDiv = document.createElement('div');
      metadataDiv.className = 'transcription-metadata';
      
      if (recording.timestamp) {
        const date = new Date(recording.timestamp);
        const dateElement = document.createElement('div');
        dateElement.className = 'metadata-item';
        dateElement.innerHTML = `<span class="metadata-label">Date:</span> ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        metadataDiv.appendChild(dateElement);
      }
      
      if (recording.duration) {
        const durationElement = document.createElement('div');
        durationElement.className = 'metadata-item';
        durationElement.innerHTML = `<span class="metadata-label">Duration:</span> ${recording.duration}`;
        metadataDiv.appendChild(durationElement);
      }
      
      // Add source info if available
      if (recording.source) {
        const sourceElement = document.createElement('div');
        sourceElement.className = 'metadata-item';
        sourceElement.innerHTML = `<span class="metadata-label">Source:</span> ${recording.source === 'tab' ? 'Tab Audio' : 'Screen Audio'}`;
        metadataDiv.appendChild(sourceElement);
      }
      
      // Insert metadata at the beginning of content
      contentElement.insertBefore(metadataDiv, contentElement.firstChild);
    }
    
    // Add copy button
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.innerHTML = '<span class="material-symbols-outlined">content_copy</span> Copy Text';
    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(recording.transcription || '')
        .then(() => {
          copyButton.innerHTML = '<span class="material-symbols-outlined">check</span> Copied!';
          setTimeout(() => {
            copyButton.innerHTML = '<span class="material-symbols-outlined">content_copy</span> Copy Text';
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy:', err);
          copyButton.innerHTML = '<span class="material-symbols-outlined">error</span> Failed to copy';
          setTimeout(() => {
            copyButton.innerHTML = '<span class="material-symbols-outlined">content_copy</span> Copy Text';
          }, 2000);
        });
    });
    
    // Add button at the end
    contentElement.appendChild(copyButton);
  });
}

/**
 * Hide transcription modal
 */
function hideTranscription() {
  if (elements.modalContainer) {
    elements.modalContainer.classList.add('hidden');
  }
}

/**
 * Delete a recording by ID
 * @param {string} recordingId - ID of the recording to delete
 */
function deleteRecording(recordingId) {
  console.log('Delete recording requested:', recordingId);
  
  // Confirm with user
  if (!confirm('Are you sure you want to delete this recording?\nThis action cannot be undone.')) {
    return;
  }
  
  // Request deletion from background
  chrome.runtime.sendMessage({
    action: 'deleteRecording',
    recordingId: recordingId
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error deleting recording:', chrome.runtime.lastError);
      alert('Failed to delete recording: ' + chrome.runtime.lastError.message);
      return;
    }
    
    if (!response || !response.success) {
      console.error('Failed to delete recording:', response ? response.error : 'Unknown error');
      alert('Failed to delete recording: ' + (response ? response.error : 'Unknown error'));
      return;
    }
    
    console.log('Recording deleted successfully');
    
    // Find and remove the recording element from the DOM
    const recordingElement = document.querySelector(`.recording-item[data-id="${recordingId}"]`);
    if (recordingElement) {
      // Check if this is the last recording in its date group
      const dateHeader = recordingElement.previousElementSibling;
      const nextElement = recordingElement.nextElementSibling;
      
      // Remove the recording
      recordingElement.remove();
      
      // If this was the last recording in its date group, remove the date header too
      if (dateHeader && dateHeader.classList.contains('date-header') && 
          (!nextElement || nextElement.classList.contains('date-header'))) {
        dateHeader.remove();
      }
    }
    
    // If we were showing the transcription for this recording, close it
    hideTranscription();
    
    // Optionally, reload the recordings list
    if (window.loadAndDisplayRecordings) {
      window.loadAndDisplayRecordings();
    }
  });
}

// Export public API
export {
  initialize,
  showTranscription,
  hideTranscription,
  deleteRecording
};
