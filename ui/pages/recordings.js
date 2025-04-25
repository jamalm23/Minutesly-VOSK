// Audio Transcription Extension - Recordings Page JavaScript

// Import database module
import * as db from '../../lib/storage/database.js';

// DOM Elements
const elements = {
  emptyState: document.getElementById('emptyState'),
  recordingsList: document.getElementById('recordingsList'),
  recordingTemplate: document.getElementById('recordingTemplate'),
  searchInput: document.getElementById('searchInput'),
  filterButton: document.getElementById('filterButton'),
  sortButton: document.getElementById('sortButton'),
  filterPanel: document.getElementById('filterPanel'),
  sortPanel: document.getElementById('sortPanel'),
  closeFilterButton: document.getElementById('closeFilterButton'),
  closeSortButton: document.getElementById('closeSortButton'),
  applyFilterButton: document.getElementById('applyFilterButton'),
  applySortButton: document.getElementById('applySortButton'),
  resetFilterButton: document.getElementById('resetFilterButton'),
  backButton: document.getElementById('backButton'),
  startRecordingButton: document.getElementById('startRecordingButton')
};

// State
const state = {
  recordings: [],
  filteredRecordings: [],
  filter: {
    dateFrom: null,
    dateTo: null,
    duration: [], // 'short', 'medium', 'long'
    hasTranscript: 'all' // 'all', 'yes', 'no'
  },
  sort: {
    by: 'date-desc' // Default sort
  },
  search: ''
};

// Initialize page
async function initializeRecordingsPage() {
  // Load recordings from database
  await loadRecordings();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initial render
  renderRecordings();
}

// Load recordings from database
async function loadRecordings() {
  try {
    // Get meetings and related recordings
    const meetings = await db.getAllItems(db.STORES_EXPORT.MEETINGS);
    state.recordings = [];
    
    // For each meeting, get its recordings
    for (const meeting of meetings) {
      const recordings = await db.getRecordingsForMeeting(meeting.id);
      
      // Combine meeting data with recording data
      recordings.forEach(recording => {
        state.recordings.push({
          id: recording.id,
          meetingId: meeting.id,
          title: meeting.title || 'Untitled Meeting',
          date: new Date(recording.date || meeting.date),
          duration: recording.duration || 0, // in seconds
          fileSize: recording.sizeBytes || 0,
          speakerCount: meeting.speakerCount || 0,
          hasTranscript: false, // Will be set below if transcript exists
          audioUrl: recording.audioUrl,
          waveform: recording.waveform
        });
      });
    }
    
    // Check for transcriptions
    const transcriptions = await db.getAllItems(db.STORES_EXPORT.TRANSCRIPTIONS);
    const transcriptionsByMeetingId = transcriptions.reduce((acc, transcription) => {
      acc[transcription.meetingId] = true;
      return acc;
    }, {});
    
    // Update recordings with transcription info
    state.recordings.forEach(recording => {
      recording.hasTranscript = !!transcriptionsByMeetingId[recording.meetingId];
    });
    
    // Apply initial sort (newest first)
    sortRecordings();
    
  } catch (error) {
    console.error('Error loading recordings:', error);
    showError('Failed to load recordings');
  }
}

// Set up event listeners
function setupEventListeners() {
  // Search input
  elements.searchInput.addEventListener('input', () => {
    state.search = elements.searchInput.value.toLowerCase();
    filterAndSortRecordings();
  });
  
  // Filter panel
  elements.filterButton.addEventListener('click', showFilterPanel);
  elements.closeFilterButton.addEventListener('click', hideFilterPanel);
  elements.applyFilterButton.addEventListener('click', applyFilter);
  elements.resetFilterButton.addEventListener('click', resetFilter);
  
  // Sort panel
  elements.sortButton.addEventListener('click', showSortPanel);
  elements.closeSortButton.addEventListener('click', hideSortPanel);
  elements.applySortButton.addEventListener('click', applySort);
  
  // Back button
  elements.backButton.addEventListener('click', () => {
    window.close();
  });
  
  // Start recording button
  elements.startRecordingButton.addEventListener('click', () => {
    window.close(); // Close this page
    // Send message to open popup
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });
  
  // Date filter inputs
  const fromDateInput = document.getElementById('fromDate');
  const toDateInput = document.getElementById('toDate');
  
  fromDateInput.addEventListener('change', () => {
    state.filter.dateFrom = fromDateInput.value ? new Date(fromDateInput.value) : null;
  });
  
  toDateInput.addEventListener('change', () => {
    state.filter.dateTo = toDateInput.value ? new Date(toDateInput.value) : null;
  });
  
  // Duration checkboxes
  const durationCheckboxes = document.querySelectorAll('input[type="checkbox"][value]');
  durationCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.filter.duration.push(checkbox.value);
      } else {
        state.filter.duration = state.filter.duration.filter(d => d !== checkbox.value);
      }
    });
  });
  
  // Transcript radio buttons
  const transcriptRadios = document.querySelectorAll('input[name="hasTranscript"]');
  transcriptRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.filter.hasTranscript = radio.value;
      }
    });
  });
  
  // Sort radio buttons
  const sortRadios = document.querySelectorAll('input[name="sortBy"]');
  sortRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.sort.by = radio.value;
      }
    });
  });
}

// Render recordings list
function renderRecordings() {
  // Check if we have recordings
  if (state.filteredRecordings.length === 0) {
    elements.emptyState.classList.remove('hidden');
    elements.recordingsList.classList.add('hidden');
    return;
  }
  
  // Hide empty state, show recordings
  elements.emptyState.classList.add('hidden');
  elements.recordingsList.classList.remove('hidden');
  
  // Clear existing recordings (except template)
  const existingCards = elements.recordingsList.querySelectorAll('.recording-card:not(.template)');
  existingCards.forEach(card => card.remove());
  
  // Add each recording
  state.filteredRecordings.forEach(recording => {
    const card = elements.recordingTemplate.cloneNode(true);
    card.classList.remove('template');
    card.id = `recording-${recording.id}`;
    
    // Set card content
    card.querySelector('.recording-title').textContent = recording.title;
    card.querySelector('.recording-date').textContent = formatDate(recording.date);
    card.querySelector('.duration').textContent = formatDuration(recording.duration);
    card.querySelector('.file-size').textContent = formatFileSize(recording.fileSize);
    card.querySelector('.speaker-count').textContent = `${recording.speakerCount} speaker${recording.speakerCount !== 1 ? 's' : ''}`;
    
    // Set audio player source if available
    const audioPlayer = card.querySelector('.audio-player');
    if (recording.audioUrl) {
      audioPlayer.src = recording.audioUrl;
    }
    
    // Set up action buttons
    setupActionButtons(card, recording);
    
    // Add to list
    elements.recordingsList.appendChild(card);
  });
}

// Set up action buttons for a recording card
function setupActionButtons(card, recording) {
  // Play button
  const playButton = card.querySelector('.play-button');
  playButton.addEventListener('click', () => {
    const audioPlayer = card.querySelector('.audio-player');
    if (audioPlayer.paused) {
      audioPlayer.play();
      playButton.innerHTML = '<span class="material-symbols-outlined">pause</span>';
    } else {
      audioPlayer.pause();
      playButton.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
    }
  });
  
  // Audio player ended event
  const audioPlayer = card.querySelector('.audio-player');
  audioPlayer.addEventListener('ended', () => {
    playButton.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
  });
  
  // Transcript button
  const transcriptButton = card.querySelector('.transcript-button');
  transcriptButton.addEventListener('click', () => {
    if (recording.hasTranscript) {
      // In a real implementation, this would open the transcript page
      chrome.tabs.create({ url: chrome.runtime.getURL(`ui/pages/transcript.html?id=${recording.meetingId}`) });
    } else {
      showError('No transcript available for this recording');
    }
  });
  
  // Summary button
  const summaryButton = card.querySelector('.summary-button');
  summaryButton.addEventListener('click', () => {
    if (recording.hasTranscript) {
      // In a real implementation, this would open the summary page
      chrome.tabs.create({ url: chrome.runtime.getURL(`ui/pages/summary.html?id=${recording.meetingId}`) });
    } else {
      showError('No transcript available for summary');
    }
  });
  
  // Export button
  const exportButton = card.querySelector('.export-button');
  exportButton.addEventListener('click', () => {
    // In a real implementation, this would trigger a download
    if (recording.audioUrl) {
      chrome.downloads.download({
        url: recording.audioUrl,
        filename: `${recording.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${formatDateForFilename(recording.date)}.mp3`,
        saveAs: true
      });
    } else {
      showError('Audio file not available for export');
    }
  });
  
  // Delete button
  const deleteButton = card.querySelector('.delete-button');
  deleteButton.addEventListener('click', async () => {
    if (confirm(`Are you sure you want to delete "${recording.title}"?`)) {
      try {
        await db.deleteItem(db.STORES_EXPORT.RECORDINGS, recording.id);
        
        // Check if this was the last recording for the meeting
        const meetingRecordings = await db.getRecordingsForMeeting(recording.meetingId);
        if (meetingRecordings.length === 0) {
          // If no more recordings, delete the meeting and related data
          await db.deleteMeetingData(recording.meetingId);
        }
        
        // Remove from state and re-render
        state.recordings = state.recordings.filter(r => r.id !== recording.id);
        filterAndSortRecordings();
      } catch (error) {
        console.error('Error deleting recording:', error);
        showError('Failed to delete recording');
      }
    }
  });
}

// Filter and sort recordings
function filterAndSortRecordings() {
  // Start with all recordings
  let filtered = [...state.recordings];
  
  // Apply search filter
  if (state.search) {
    filtered = filtered.filter(recording => 
      recording.title.toLowerCase().includes(state.search)
    );
  }
  
  // Apply date filter
  if (state.filter.dateFrom) {
    filtered = filtered.filter(recording => 
      recording.date >= state.filter.dateFrom
    );
  }
  
  if (state.filter.dateTo) {
    const dateTo = new Date(state.filter.dateTo);
    dateTo.setHours(23, 59, 59, 999); // End of day
    filtered = filtered.filter(recording => 
      recording.date <= dateTo
    );
  }
  
  // Apply duration filter
  if (state.filter.duration.length > 0) {
    filtered = filtered.filter(recording => {
      const durationMinutes = recording.duration / 60;
      
      if (state.filter.duration.includes('short') && durationMinutes < 15) {
        return true;
      }
      
      if (state.filter.duration.includes('medium') && durationMinutes >= 15 && durationMinutes <= 30) {
        return true;
      }
      
      if (state.filter.duration.includes('long') && durationMinutes > 30) {
        return true;
      }
      
      return false;
    });
  }
  
  // Apply transcript filter
  if (state.filter.hasTranscript !== 'all') {
    const wantsTranscript = state.filter.hasTranscript === 'yes';
    filtered = filtered.filter(recording => 
      recording.hasTranscript === wantsTranscript
    );
  }
  
  // Update state
  state.filteredRecordings = filtered;
  
  // Apply sorting
  sortRecordings();
  
  // Render the filtered list
  renderRecordings();
}

// Sort recordings based on current sort setting
function sortRecordings() {
  state.filteredRecordings.sort((a, b) => {
    switch (state.sort.by) {
      case 'date-desc':
        return b.date - a.date;
      case 'date-asc':
        return a.date - b.date;
      case 'duration-desc':
        return b.duration - a.duration;
      case 'duration-asc':
        return a.duration - b.duration;
      case 'size-desc':
        return b.fileSize - a.fileSize;
      case 'size-asc':
        return a.fileSize - b.fileSize;
      default:
        return b.date - a.date;
    }
  });
}

// Apply filter
function applyFilter() {
  filterAndSortRecordings();
  hideFilterPanel();
}

// Reset filter
function resetFilter() {
  // Reset date inputs
  document.getElementById('fromDate').value = '';
  document.getElementById('toDate').value = '';
  
  // Reset duration checkboxes
  const durationCheckboxes = document.querySelectorAll('input[type="checkbox"][value]');
  durationCheckboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  
  // Reset transcript radio
  document.querySelector('input[name="hasTranscript"][value="all"]').checked = true;
  
  // Reset state
  state.filter = {
    dateFrom: null,
    dateTo: null,
    duration: [],
    hasTranscript: 'all'
  };
  
  // Apply reset filter
  filterAndSortRecordings();
}

// Apply sort
function applySort() {
  sortRecordings();
  renderRecordings();
  hideSortPanel();
}

// Show filter panel
function showFilterPanel() {
  elements.filterPanel.classList.add('visible');
}

// Hide filter panel
function hideFilterPanel() {
  elements.filterPanel.classList.remove('visible');
}

// Show sort panel
function showSortPanel() {
  elements.sortPanel.classList.add('visible');
}

// Hide sort panel
function hideSortPanel() {
  elements.sortPanel.classList.remove('visible');
}

// Format date for display
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Format date for filename
function formatDateForFilename(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

// Format duration (seconds to MM:SS or HH:MM:SS)
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format file size (bytes to KB, MB, etc.)
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Show error message (for now, just console.log)
function showError(message) {
  console.error(message);
  // In a real implementation, this would show a UI error message
  alert(message);
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeRecordingsPage);
