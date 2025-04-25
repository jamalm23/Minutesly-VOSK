// Audio Transcription Extension - Dashboard JavaScript

// Import database module from db-manager instead of database.js
import { getAllRecordings, getRecordingById } from '../../background/db-manager.js';

// DOM Elements (Original Structure)
const elements = {
  // Summary metrics
  totalRecordings: document.getElementById('totalRecordings'),
  hoursRecorded: document.getElementById('hoursRecorded'),
  transcribedMeetings: document.getElementById('transcribedMeetings'),
  storageUsed: document.getElementById('storageUsed'),
  
  // Tab navigation
  tabButtons: document.querySelectorAll('.tab-button'), // Includes the new recordings tab
  tabPanes: document.querySelectorAll('.tab-pane'), // Includes the new recordings pane
  
  // Recent recordings (in Overview tab)
  recentRecordings: document.getElementById('recentRecordings'), 
  
  // Action buttons
  backButton: document.getElementById('backButton'),
  settingsButton: document.getElementById('settingsButton'),
  viewAllTopicsButton: document.getElementById('viewAllTopicsButton'),

  // Recordings Tab Elements (NEW)
  recordingsListContainer: document.getElementById('dashboard-recordings-list'),
  audioPlayer: document.getElementById('dashboard-audio-player'),
  searchInput: document.getElementById('dashboard-search-input')
};

// State for Recordings Tab (NEW)
let allDashboardRecordings = []; 

// Initialize dashboard (Original + New Tab Logic)
async function initializeDashboard() {
  setupEventListeners(); // Updated to include recordings tab
  await loadDashboardData(); // Loads initial overview data

  // Check if Recordings tab should be loaded initially (e.g., if it's the active tab)
  const initialActiveTab = document.querySelector('.tab-button.active');
  if (initialActiveTab && initialActiveTab.getAttribute('data-tab') === 'recordings') {
      loadAndDisplayDashboardRecordings();
  }
}

// Set up event listeners (Updated)
function setupEventListeners() {
  // Tab switching (Handles all tabs including Recordings)
  elements.tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      switchTab(tabId);

      // If Recordings tab is activated, load its data
      if (tabId === 'recordings') {
          loadAndDisplayDashboardRecordings();
      }
    });
  });
  
  // Original button listeners
  elements.backButton?.addEventListener('click', () => { window.close(); });
  elements.settingsButton?.addEventListener('click', () => { console.log('Settings button clicked'); });
  elements.viewAllTopicsButton?.addEventListener('click', () => { console.log('View all topics button clicked'); });

  // Event delegation for Recordings Tab (NEW)
  if (elements.recordingsListContainer) {
      elements.recordingsListContainer.addEventListener('click', handleRecordingActionClick);
  }
  // TODO: Add listener for search input later
}

// Switch active tab (Original Logic - works with new tab)
function switchTab(tabId) {
  elements.tabButtons.forEach(button => {
    button.classList.toggle('active', button.getAttribute('data-tab') === tabId);
  });
  elements.tabPanes.forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

// Load dashboard data for Overview tab (Original Logic)
async function loadDashboardData() {
  try {
    const stats = await getStorageStats();
    updateDashboardMetrics(stats);
    await loadRecentRecordings(); // Load for overview tab
  } catch (error) {
    console.error('Error loading overview dashboard data:', error);
  }
}

// Update dashboard metrics (Original Logic)
function updateDashboardMetrics(stats) {
  elements.totalRecordings.textContent = stats.recordingsCount || 0;
  let totalSeconds = 0;
  if (stats.recordings) { // Assuming stats now contains seconds directly or needs calculation
    totalSeconds = stats.recordings.reduce((total, recording) => total + (recording.duration || 0), 0);
  }
  elements.hoursRecorded.textContent = formatDuration(totalSeconds, true); // Use hours format
  elements.transcribedMeetings.textContent = stats.transcriptionsCount || 0;
  elements.storageUsed.textContent = formatFileSize(stats.recordingsSizeBytes || 0);
}

// Load recent recordings for Overview tab (Original Logic - Minor changes possible)
async function loadRecentRecordings() {
  try {
    // Use db-manager's getAllRecordings instead of getAllItems
    const recordings = await getAllRecordings();
    const container = elements.recentRecordings;
    if (!container) return;

    if (recordings.length === 0) {
      container.innerHTML = `<div class="empty-placeholder"><span class="material-symbols-outlined">podcasts</span><p>No recordings yet</p></div>`;
      return;
    }
    
    container.innerHTML = ''; 
    for (const recording of recordings) {
      const recordingItem = document.createElement('div');
      recordingItem.className = 'recording-item'; // Use the existing class for basic structure
      recordingItem.innerHTML = `
        <div class="recording-info">
          <h3 class="recording-title">${recording.metadata?.title || 'Untitled Recording'}</h3>
          <div class="recording-meta">
            <span>${formatDate(new Date(recording.timestamp || Date.now()).toISOString())}</span>
            <span>${formatDuration(recording.metadata?.duration || 0)}</span> 
          </div>
        </div>
        <div class="dashboard-item-actions"> 
          <button class="view-details-button icon-button" data-recording-id="${recording.id}" title="View Details">
            <span class="material-symbols-outlined">info</span>
          </button>
        </div>
      `;
      
      const viewButton = recordingItem.querySelector('.view-details-button');
      viewButton?.addEventListener('click', () => {
          console.log("View details for recording:", recording.id); 
          // For now, just switch to the recordings tab
          switchTab('recordings');
          loadAndDisplayDashboardRecordings(); // Reload recordings tab
      });
      
      container.appendChild(recordingItem);
    }
    
  } catch (error) {
    console.error('Error loading recent recordings:', error);
    elements.recentRecordings.innerHTML = `<div class="empty-placeholder"><span class="material-symbols-outlined">error</span><p>Error loading recordings</p></div>`;
  }
}

// --- Recordings Tab Functions (NEW) ---
function loadAndDisplayDashboardRecordings() {
    console.log('Attempting to fetch recordings for dashboard...');
    if (!elements.recordingsListContainer) return;
    elements.recordingsListContainer.innerHTML = '<p class="loading-message">Loading recordings...</p>';
    
    console.log('Sending getRecordings message to service worker...');
    chrome.runtime.sendMessage({ action: 'getRecordings' }, async (response) => {
        console.log('Received response from getRecordings:', response);
        if (chrome.runtime.lastError) {
            console.error("Chrome runtime error:", chrome.runtime.lastError);
            
            // Try direct loading as fallback
            if (await loadRecordingsDirectly()) {
                return;
            }
            
            allDashboardRecordings = [];
            renderDashboardRecordingsList(null, "Error loading recordings: " + chrome.runtime.lastError.message);
            return;
        }
        
        if (!response?.success) {
            console.error("Error response from service worker:", response);
            
            // Try direct loading as fallback
            if (await loadRecordingsDirectly()) {
                return;
            }
            
            allDashboardRecordings = [];
            renderDashboardRecordingsList(null, "Error loading recordings: " + (response?.error || "Unknown error"));
            return;
        }
        
        console.log("Received recordings for dashboard:", response.recordings);
        allDashboardRecordings = response.recordings || [];
        renderDashboardRecordingsList(allDashboardRecordings);
    });
}

// Load recordings directly from database module as fallback
async function loadRecordingsDirectly() {
    try {
        // Use getAllRecordings from db-manager
        const recordings = await getAllRecordings();
        console.log("Loaded recordings directly:", recordings);
        if (recordings && recordings.length > 0) {
            allDashboardRecordings = recordings;
            renderDashboardRecordingsList(recordings);
            return true;
        } else {
            renderDashboardRecordingsList([], "No recordings found in database.");
            return false;
        }
    } catch (error) {
        console.error("Error loading recordings directly:", error);
        return false;
    }
}

function renderDashboardRecordingsList(recordings, errorMessage = 'No recordings available.') {
    const container = elements.recordingsListContainer;
    if (!container) return;
    container.innerHTML = ''; // Clear previous list

    if (!recordings || recordings.length === 0) {
        container.innerHTML = `<p class="loading-message">${errorMessage}</p>`;
    } else {
        let lastDateStr = null;
        recordings.forEach(recording => {
            if (!recording || !recording.metadata || !recording.metadata.timestamp) {
               console.warn('Skipping dashboard item due to missing data:', recording);
               return;
            }
            const recordingDate = new Date(recording.metadata.timestamp);
            const currentDateStr = recordingDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
            if (currentDateStr !== lastDateStr) {
                const dateHeader = document.createElement('div');
                dateHeader.className = 'dashboard-date-header';
                dateHeader.textContent = currentDateStr;
                container.appendChild(dateHeader);
                lastDateStr = currentDateStr;
            }
            const item = document.createElement('div');
            item.className = 'dashboard-recording-item';
            item.dataset.id = recording.id;

            // --- Placeholder Analysis Data ---
            const analysis = recording.analysis || {}; 
            const metadata = recording.metadata || {};
            const importance = analysis.importance || 'N/A';
            const sentiment = analysis.sentiment || 'Neutral'; 
            const topics = analysis.topics || []; 
            const actionItemsCount = analysis.actionItemsCount || 0;
            const followUpRequired = analysis.followUpRequired === true;
            const transcriptionStatus = metadata.transcriptionStatus || 'Not Transcribed'; 
            const detectedLanguage = metadata.detectedLanguage || 'N/A'; 
            const speakerCount = metadata.speakerCount || 'N/A'; 
            const keywords = analysis.keywords || [];
            const summaryStatus = analysis.summaryStatus || 'Not Generated';
            // --- End Placeholder ---

            const dateStr = recordingDate.toLocaleString();
            const durationStr = formatDuration(metadata.duration);
            const sizeStr = formatFileSize(metadata.fileSize);
            const pageTitle = metadata.title || 'No Title';
            
            item.innerHTML = `
                <div class="dashboard-item-info">
                    <div class="dashboard-item-title">${metadata.filename || 'Recording'}</div>
                    <div class="dashboard-item-details">
                        <span><span class="material-symbols-outlined">calendar_today</span> ${dateStr}</span>
                        <span><span class="material-symbols-outlined">timer</span> ${durationStr}</span>
                        <span><span class="material-symbols-outlined">save</span> ${sizeStr}</span>
                        <span class="page-title"><span class="material-symbols-outlined">link</span> ${pageTitle}</span>
                    </div>
                    <div class="dashboard-item-analysis">
                        <span class="item-analysis-status" title="Transcription Status"><b>Status:</b> ${transcriptionStatus}</span> 
                        <span class="item-analysis-summary-status" title="Summary Status"><b>Summary:</b> ${summaryStatus}</span>
                        <span class="item-analysis-lang" title="Detected Language"><b>Lang:</b> ${detectedLanguage}</span>
                        <span class="item-analysis-speakers" title="Speaker Count"><b>Speakers:</b> ${speakerCount}</span>
                        <span class="item-analysis-importance" title="Importance"><b>Importance:</b> ${importance}</span>
                        <span class="item-analysis-sentiment" title="Overall Sentiment"><b>Sentiment:</b> ${sentiment}</span>
                        <span class="item-analysis-actions" title="Action Items"><b>Actions:</b> ${actionItemsCount}</span>
                        <span class="item-analysis-followup" title="Follow-up Required?"><b>Follow-up:</b> ${followUpRequired ? 'Yes' : 'No'}</span>
                        <span class="item-analysis-topics" title="Topics"><b>Topics:</b> ${topics.length > 0 ? topics.slice(0, 3).join(', ') + (topics.length > 3 ? '...' : '') : 'N/A'}</span> 
                        <span class="item-analysis-keywords" title="Keywords"><b>Keywords:</b> ${keywords.length > 0 ? keywords.slice(0, 3).join(', ') + (keywords.length > 3 ? '...' : '') : 'N/A'}</span>
                    </div>
                </div>
                <div class="dashboard-item-actions">
                    <button class="play-button icon-button" title="Play Recording">
                        <span class="material-symbols-outlined">play_arrow</span>
                    </button>
                    <button class="generate-summary-button icon-button" title="Generate AI Meeting Summary">
                        <span class="material-symbols-outlined">auto_awesome</span>
                    </button>
                    <button class="details-button icon-button" title="View Recording Details">
                        <span class="material-symbols-outlined">info</span>
                    </button>
                    <button class="delete-button icon-button" title="Delete Recording">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            `;
            
            // Make the entire recording item clickable for opening details
            item.addEventListener('click', (event) => {
                // Don't navigate if clicking on a button or action area
                if (!event.target.closest('.icon-button') && !event.target.closest('.dashboard-item-actions')) {
                    navigateToRecordingDetails(recording.id);
                }
            });
            
            container.appendChild(item);
        });
    }
}

function handleRecordingActionClick(event) {
    const playButton = event.target.closest('.play-button');
    const deleteButton = event.target.closest('.delete-button');
    const summaryButton = event.target.closest('.generate-summary-button');
    const detailsButton = event.target.closest('.details-button'); // Handler for explicit details button
    const recordingItem = event.target.closest('.dashboard-recording-item');
    
    if (!recordingItem) return;
    const recordingId = recordingItem.dataset.id;
    if (!recordingId) return;

    if (playButton) {
        playDashboardRecording(recordingId);
    } else if (deleteButton) {
        deleteDashboardRecording(recordingId);
    } else if (summaryButton) {
        console.log(`Generate AI Summary clicked for recording ID: ${recordingId}`);
        alert(`AI Summary generation for ${recordingId} not implemented yet.`);
    } else if (detailsButton) {
        // Handle view details button click (still useful if user prefers clicking the icon)
        navigateToRecordingDetails(recordingId);
    }
}

async function playDashboardRecording(recordingId) {
    try {
        // Getting the audio player
        const audioPlayer = elements.audioPlayer;
        if (!audioPlayer) {
            console.error("Audio player element not found");
            return;
        }
        
        console.log(`Loading recording ${recordingId} for playback`);
        
        // Try to get the recording directly from IndexedDB first
        try {
            const recording = await getRecordingById(recordingId);
            if (recording && recording.audioBlob) {
                const audioUrl = URL.createObjectURL(recording.audioBlob);
                audioPlayer.src = audioUrl;
                audioPlayer.play();
                return;
            }
        } catch (dbError) {
            console.warn("Couldn't load recording directly from IndexedDB:", dbError);
        }
        
        // Fall back to message passing if direct access fails
        chrome.runtime.sendMessage({ 
            action: 'getRecordingById', 
            id: recordingId 
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error fetching recording:", chrome.runtime.lastError);
                return;
            }
            
            if (response.success && response.recording) {
                const recording = response.recording;
                
                // Create blob from base64 or ArrayBuffer data if needed
                if (recording.audioData) {
                    let audioBlob;
                    if (recording.audioBlob) {
                        audioBlob = recording.audioBlob;
                    } else if (typeof recording.audioData === 'string') {
                        // Assuming it's base64
                        const binaryData = atob(recording.audioData);
                        const arrayBuffer = new ArrayBuffer(binaryData.length);
                        const uint8Array = new Uint8Array(arrayBuffer);
                        for (let i = 0; i < binaryData.length; i++) {
                            uint8Array[i] = binaryData.charCodeAt(i);
                        }
                        audioBlob = new Blob([uint8Array], { type: 'audio/webm' });
                    } else if (recording.audioData instanceof ArrayBuffer) {
                        audioBlob = new Blob([recording.audioData], { type: 'audio/webm' });
                    }
                    
                    if (audioBlob) {
                        const audioUrl = URL.createObjectURL(audioBlob);
                        audioPlayer.src = audioUrl;
                        audioPlayer.play();
                    }
                }
            } else {
                console.error("Error fetching recording data:", response.error);
            }
        });
    } catch (error) {
        console.error("Error playing recording:", error);
    }
}

function deleteDashboardRecording(recordingId) {
    if (window.confirm(`Are you sure you want to permanently delete recording ${recordingId}?`)) {
        console.log(`Dashboard: Requesting deletion of ${recordingId}`);
        chrome.runtime.sendMessage({ action: 'deleteRecording', id: recordingId }, (response) => {
            if (chrome.runtime.lastError || !response?.success) {
                console.error("Dashboard: Error deleting recording:", chrome.runtime.lastError?.message || response?.error);
                alert("Failed to delete recording: " + (response?.error || 'Unknown error'));
            } else {
                console.log(`Dashboard: Recording ${recordingId} deleted successfully.`);
                const itemToRemove = elements.recordingsListContainer.querySelector(`.dashboard-recording-item[data-id="${recordingId}"]`);
                if (itemToRemove) {
                    const header = itemToRemove.previousElementSibling;
                    const nextItem = itemToRemove.nextElementSibling;
                    itemToRemove.remove();
                    if (header && header.classList.contains('dashboard-date-header') && (!nextItem || nextItem.classList.contains('dashboard-date-header'))) {
                       header.remove();
                    }
                }
                allDashboardRecordings = allDashboardRecordings.filter(rec => rec.id !== recordingId);
                if (elements.recordingsListContainer.children.length === 0) {
                   renderDashboardRecordingsList(null);
                }
            }
        });
    }
}

// Add this new function for navigation
function navigateToRecordingDetails(recordingId) {
    // Open recording details in a new tab using the integrated timeline page, adding autoplay parameter
    const detailsUrl = chrome.runtime.getURL(`ui/pages/timeline/timeline.html?id=${recordingId}&autoplay=true`);
    chrome.tabs.create({ url: detailsUrl });
    
    // Alternative approach if the above doesn't work in all contexts:
    // window.open(`../pages/timeline/timeline.html?id=${recordingId}&autoplay=true`, '_blank');
}

// Added getStorageStats function using the recordings database
async function getStorageStats() {
  try {
    // Try to get all recordings using existing function
    const recordings = await getAllRecordings();
    
    // Calculate stats
    const stats = {
      recordingsCount: recordings.length,
      recordings: recordings,
      recordingsSizeBytes: recordings.reduce((total, rec) => {
        // Estimate size based on audio data (if available) or metadata
        const size = rec.metadata?.fileSize || 
                    (rec.audioDataUrl ? rec.audioDataUrl.length * 0.75 : 0);
        return total + size;
      }, 0),
      transcriptionsCount: recordings.filter(rec => rec.metadata?.hasTranscript).length
    };
    
    console.log('Dashboard calculated storage stats:', stats);
    return stats;
  } catch (error) {
    console.error('Error calculating storage stats:', error);
    // Return default values if there's an error
    return {
      recordingsCount: 0,
      recordings: [],
      recordingsSizeBytes: 0,
      transcriptionsCount: 0
    };
  }
}

// --- Helper Functions (Original + Recordings Tab Needs) ---
function formatDate(dateString) {
    if (!dateString) return 'Invalid Date';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function formatDuration(ms, showHours = false) {
    if (typeof ms !== 'number' || ms < 0) return 'N/A';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0 || showHours) {
        return [hours, minutes, seconds].map(val => val.toString().padStart(2, '0')).join(':');
    } else {
        return [minutes, seconds].map(val => val.toString().padStart(2, '0')).join(':');
    }
}

function formatFileSize(bytes) {
    if (bytes == null || typeof bytes !== 'number' || bytes < 0) {
        return '--';
    }
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    // Ensure i is within bounds of sizes array
    const index = Math.min(i, sizes.length - 1);
    return parseFloat((bytes / Math.pow(k, index)).toFixed(1)) + ' ' + sizes[index];
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeDashboard);
