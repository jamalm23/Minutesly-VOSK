// recordings-list.js - Handles display and filtering of recordings
// Part of the modularization effort to comply with file size limits (Rule III.4)

/**
 * Recordings list module for displaying and managing saved recordings
 * Handles loading, filtering, and presenting recordings to the user
 */

// References to DOM elements
let elements = {
  recordingsListContainer: null,
  searchInput: null,
  titleFilterButton: null,
  titleFilterDropdown: null,
  startDateFilter: null,
  endDateFilter: null,
  clearDatesButton: null
};

// Current list state
let state = {
  allRecordings: [],
  filteredRecordings: [],
  selectedTitleFilters: []
};

// Event callbacks
let callbacks = {
  onPlay: null,
  onDelete: null,
  onView: null
};

/**
 * Initialize recordings list manager with DOM elements
 * @param {Object} domElements - Object containing DOM elements
 * @param {Object} eventCallbacks - Callbacks for recording actions
 */
function initialize(domElements, eventCallbacks) {
  elements = {
    recordingsListContainer: domElements.recordingsListContainer,
    searchInput: domElements.searchInput,
    titleFilterButton: domElements.titleFilterButton,
    titleFilterDropdown: domElements.titleFilterDropdown,
    startDateFilter: domElements.startDateFilter,
    endDateFilter: domElements.endDateFilter,
    clearDatesButton: domElements.clearDatesButton
  };
  
  callbacks = {
    onPlay: eventCallbacks.onPlay || function() {},
    onDelete: eventCallbacks.onDelete || function() {},
    onView: eventCallbacks.onView || function() {}
  };
  
  // Setup event listeners
  if (elements.searchInput) {
    elements.searchInput.addEventListener('input', handleFilterChange);
  }
  
  if (elements.startDateFilter) {
    elements.startDateFilter.addEventListener('change', handleFilterChange);
  }
  
  if (elements.endDateFilter) {
    elements.endDateFilter.addEventListener('change', handleFilterChange);
  }
  
  if (elements.clearDatesButton) {
    elements.clearDatesButton.addEventListener('click', clearDateFilters);
  }
  
  if (elements.titleFilterButton) {
    elements.titleFilterButton.addEventListener('click', toggleTitleFilterDropdown);
  }
  
  // Close dropdown when clicking outside
  document.addEventListener('click', handleClickOutside);
}

/**
 * Load and display recordings
 */
function loadAndDisplayRecordings() {
  console.log('Loading recordings');
  
  // Request recordings from background
  chrome.runtime.sendMessage({ action: 'getRecordings' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting recordings:', chrome.runtime.lastError);
      renderRecordingsList([], 'Error loading recordings: ' + chrome.runtime.lastError.message);
      return;
    }
    
    if (!response || !response.recordings) {
      console.error('Invalid response from background:', response);
      renderRecordingsList([], 'Error: Invalid response from service worker');
      return;
    }
    
    console.log('Loaded recordings:', response.recordings);
    state.allRecordings = response.recordings;
    state.filteredRecordings = [...state.allRecordings];
    
    // Populate title filter dropdown
    populateTitleFilter(response.recordings);
    
    // Render the recordings
    renderRecordingsList(state.filteredRecordings);
  });
}

/**
 * Populate title filter dropdown
 * @param {Array} recordings - List of recordings
 */
function populateTitleFilter(recordings) {
  if (!elements.titleFilterDropdown) return;
  
  // Clear existing options
  elements.titleFilterDropdown.innerHTML = '';
  
  // Get unique titles sorted alphabetically
  const titles = [...new Set(recordings.map(r => (r.metadata && r.metadata.title) || r.title || 'Untitled'))]
    .sort((a, b) => a.localeCompare(b));
  
  // Add "Select All" option at the top
  const selectAllLabel = document.createElement('label');
  selectAllLabel.className = 'filter-option select-all';
  
  const selectAllCheckbox = document.createElement('input');
  selectAllCheckbox.type = 'checkbox';
  selectAllCheckbox.checked = state.selectedTitleFilters.length === 0;
  selectAllCheckbox.addEventListener('change', (e) => {
    const checkboxes = elements.titleFilterDropdown.querySelectorAll('input[type="checkbox"]');
    
    if (e.target.checked) {
      // Clear all filters
      state.selectedTitleFilters = [];
      
      // Check all boxes except self (which is already checked)
      checkboxes.forEach((cb, i) => {
        if (i > 0) cb.checked = false;
      });
    } else {
      // Select all titles
      state.selectedTitleFilters = [...titles];
      
      // Check all boxes except self (which is already unchecked)
      checkboxes.forEach((cb, i) => {
        if (i > 0) cb.checked = true;
      });
    }
    
    updateTitleFilterButtonText();
    applyFiltersAndRender();
  });
  
  selectAllLabel.appendChild(selectAllCheckbox);
  selectAllLabel.appendChild(document.createTextNode('All Titles'));
  elements.titleFilterDropdown.appendChild(selectAllLabel);
  
  // Add individual title options
  titles.forEach(title => {
    const label = document.createElement('label');
    label.className = 'filter-option';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = title;
    checkbox.checked = state.selectedTitleFilters.includes(title);
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        state.selectedTitleFilters.push(title);
      } else {
        state.selectedTitleFilters = state.selectedTitleFilters.filter(t => t !== title);
      }
      
      // Update "Select All" checkbox
      const selectAll = elements.titleFilterDropdown.querySelector('.select-all input');
      if (selectAll) {
        selectAll.checked = state.selectedTitleFilters.length === 0;
      }
      
      updateTitleFilterButtonText();
      applyFiltersAndRender();
    });
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(title));
    elements.titleFilterDropdown.appendChild(label);
  });
  
  // Update the button text
  updateTitleFilterButtonText();
}

/**
 * Combined handler for search or filter changes
 */
function handleFilterChange() {
  applyFiltersAndRender();
}

/**
 * Apply all active filters and render the result
 */
function applyFiltersAndRender() {
  const searchTerm = elements.searchInput ? elements.searchInput.value.trim().toLowerCase() : '';
  const startDate = elements.startDateFilter ? elements.startDateFilter.value : '';
  const endDate = elements.endDateFilter ? elements.endDateFilter.value : '';
  
  state.filteredRecordings = filterRecordings(
    searchTerm,
    state.selectedTitleFilters,
    startDate,
    endDate
  );
  
  renderRecordingsList(state.filteredRecordings);
}

/**
 * Filter recordings based on search and filters
 * @param {string} searchTerm - Text to search for
 * @param {Array} titleFilters - Titles to filter by
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array} Filtered recordings
 */
function filterRecordings(searchTerm, titleFilters, startDate, endDate) {
  return state.allRecordings.filter(recording => {
    // Title match (if filters are selected)
    if (titleFilters.length > 0) {
      const recordingTitle = (recording.metadata && recording.metadata.title) || recording.title || 'Untitled';
      if (!titleFilters.includes(recordingTitle)) {
        return false;
      }
    }
    
    // Search term match
    if (searchTerm) {
      const recordingTitle = ((recording.metadata && recording.metadata.title) || recording.title || 'Untitled').toLowerCase();
      const recordingTranscription = (recording.metadata && recording.metadata.transcription) || (recording.transcription || '').toLowerCase();
      
      if (!recordingTitle.includes(searchTerm) && 
          !recordingTranscription.includes(searchTerm)) {
        return false;
      }
    }
    
    // Date range match
    if (startDate || endDate) {
      const recordingDate = new Date(recording.timestamp);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (recordingDate < start) {
          return false;
        }
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (recordingDate > end) {
          return false;
        }
      }
    }
    
    return true;
  });
}

/**
 * Format file size in a human-readable way
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format duration in a human-readable way
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secondsRemaining = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secondsRemaining.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secondsRemaining.toString().padStart(2, '0')}`;
  }
}

/**
 * Render the recordings list
 * @param {Array} recordings - Recordings to display
 * @param {string} errorMessage - Optional error message
 */
function renderRecordingsList(recordings, errorMessage = 'No recordings found.') {
  if (!elements.recordingsListContainer) return;
  
  // Clear container
  elements.recordingsListContainer.innerHTML = '';
  
  if (!recordings || recordings.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = errorMessage;
    elements.recordingsListContainer.appendChild(emptyMessage);
    return;
  }
  
  // Group recordings by date
  const groupedRecordings = {};
  
  recordings.forEach(recording => {
    const date = new Date(recording.timestamp);
    const dateString = date.toLocaleDateString();
    
    if (!groupedRecordings[dateString]) {
      groupedRecordings[dateString] = [];
    }
    
    groupedRecordings[dateString].push(recording);
  });
  
  // Create sections for each date
  Object.keys(groupedRecordings).sort((a, b) => {
    return new Date(b) - new Date(a); // Newest first
  }).forEach(dateString => {
    // Create date header
    const dateHeader = document.createElement('div');
    dateHeader.className = 'date-header';
    dateHeader.textContent = dateString;
    elements.recordingsListContainer.appendChild(dateHeader);
    
    // Create recordings for this date
    groupedRecordings[dateString].forEach(recording => {
      // Create recording item
      const recordingItem = document.createElement('div');
      recordingItem.className = 'recording-item';
      recordingItem.dataset.id = recording.id;
      
      // Create title
      const title = document.createElement('div');
      title.className = 'recording-title';
      title.textContent = (recording.metadata && recording.metadata.title) || 
                          recording.title || 
                          'Untitled Recording';
      
      // Create time
      const time = document.createElement('div');
      time.className = 'recording-time';
      const recordingDate = new Date(recording.timestamp);
      time.textContent = recordingDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      // Create size
      const size = document.createElement('div');
      size.className = 'recording-size';
      // Check both direct property and nested metadata property
      const fileSize = (recording.metadata && recording.metadata.fileSize) || 
                       recording.size || 
                       (recording.audioDataUrl ? recording.audioDataUrl.length * 0.75 : 0);
      size.textContent = formatFileSize(fileSize);
      
      // Create duration
      const duration = document.createElement('div');
      duration.className = 'recording-duration';
      // Check both direct property and nested metadata property
      const durationValue = (recording.metadata && recording.metadata.duration) || 
                           recording.duration || 
                           '00:00';
      duration.textContent = typeof durationValue === 'number' ? 
                             formatDuration(durationValue) : 
                             durationValue;
      
      // Create metadata container
      const metadata = document.createElement('div');
      metadata.className = 'recording-metadata';
      metadata.appendChild(time);
      metadata.appendChild(size);
      metadata.appendChild(duration);
      
      // Create actions
      const actions = document.createElement('div');
      actions.className = 'recording-actions';
      
      // Play button
      const playBtn = document.createElement('button');
      playBtn.className = 'action-button play-button';
      playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
      playBtn.title = 'Play';
      playBtn.dataset.action = 'play';
      playBtn.dataset.id = recording.id;
      
      // View button
      const viewBtn = document.createElement('button');
      viewBtn.className = 'action-button view-button';
      viewBtn.innerHTML = '<span class="material-symbols-outlined">description</span>';
      viewBtn.title = 'View Transcription';
      viewBtn.dataset.action = 'view';
      viewBtn.dataset.id = recording.id;
      
      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-button delete-button';
      deleteBtn.innerHTML = '<span class="material-symbols-outlined">delete</span>';
      deleteBtn.title = 'Delete';
      deleteBtn.dataset.action = 'delete';
      deleteBtn.dataset.id = recording.id;
      
      // Add buttons to actions
      actions.appendChild(playBtn);
      actions.appendChild(viewBtn);
      actions.appendChild(deleteBtn);
      
      // Add elements to recording item
      recordingItem.appendChild(title);
      recordingItem.appendChild(metadata);
      recordingItem.appendChild(actions);
      
      // Add item to container
      elements.recordingsListContainer.appendChild(recordingItem);
    });
  });
  
  // Add event listener for recording actions
  elements.recordingsListContainer.addEventListener('click', handleRecordingActionClick);
}

/**
 * Function to clear date filters specifically
 */
function clearDateFilters() {
  if (elements.startDateFilter) {
    elements.startDateFilter.value = '';
  }
  
  if (elements.endDateFilter) {
    elements.endDateFilter.value = '';
  }
  
  // Reapply filters with cleared dates
  applyFiltersAndRender();
}

/**
 * Toggle visibility of the title filter dropdown
 */
function toggleTitleFilterDropdown() {
  if (!elements.titleFilterButton || !elements.titleFilterDropdown) return;
  elements.titleFilterDropdown.classList.toggle('visible');
}

/**
 * Close dropdown if click is outside
 * @param {Event} event - Click event
 */
function handleClickOutside(event) {
  if (!elements.titleFilterButton || !elements.titleFilterDropdown) return;
  
  if (!elements.titleFilterButton.contains(event.target) && 
      !elements.titleFilterDropdown.contains(event.target)) {
    elements.titleFilterDropdown.classList.remove('visible');
  }
}

/**
 * Function to reset the title filter state and UI
 */
function resetTitleFilter() {
  state.selectedTitleFilters = [];
  
  if (elements.titleFilterDropdown) {
    const checkboxes = elements.titleFilterDropdown.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach((cb, i) => {
      cb.checked = i === 0; // Check only the "All" option
    });
  }
  
  updateTitleFilterButtonText();
  applyFiltersAndRender();
}

/**
 * Update the text on the title filter button
 */
function updateTitleFilterButtonText() {
  if (!elements.titleFilterButton) return;
  
  if (state.selectedTitleFilters.length === 0) {
    elements.titleFilterButton.textContent = 'All Titles';
    elements.titleFilterButton.classList.remove('active');
  } else if (state.selectedTitleFilters.length === 1) {
    elements.titleFilterButton.textContent = state.selectedTitleFilters[0];
    elements.titleFilterButton.classList.add('active');
  } else {
    elements.titleFilterButton.textContent = `${state.selectedTitleFilters.length} titles`;
    elements.titleFilterButton.classList.add('active');
  }
}

/**
 * Handler for clicks within the recordings list
 * @param {Event} event - Click event
 */
function handleRecordingActionClick(event) {
  // Find closest action button
  const actionButton = event.target.closest('.action-button');
  if (!actionButton) return;
  
  const action = actionButton.dataset.action;
  const recordingId = actionButton.dataset.id;
  
  if (!recordingId) return;
  
  switch (action) {
    case 'play':
      if (callbacks.onPlay) callbacks.onPlay(recordingId);
      break;
    case 'view':
      if (callbacks.onView) callbacks.onView(recordingId);
      break;
    case 'delete':
      if (callbacks.onDelete) callbacks.onDelete(recordingId);
      break;
    default:
      console.warn('Unknown action:', action);
  }
}

// Export public API
export {
  initialize,
  loadAndDisplayRecordings,
  renderRecordingsList,
  handleFilterChange,
  applyFiltersAndRender,
  filterRecordings,
  clearDateFilters,
  resetTitleFilter,
  handleRecordingActionClick,
  formatFileSize,
  formatDuration
};
