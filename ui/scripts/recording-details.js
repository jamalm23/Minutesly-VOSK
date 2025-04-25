// Recording Details JavaScript File
// This file handles the functionality for the recording details page

// Elements
const elements = {
  // Header elements
  recordingTitle: document.getElementById('recording-title'),
  recordingDate: document.getElementById('recording-date'),
  downloadBtn: document.querySelector('.download-btn'),
  
  // Player elements
  playPauseBtn: document.getElementById('play-pause-btn'),
  waveform: document.getElementById('waveform'),
  currentTime: document.getElementById('current-time'),
  totalTime: document.getElementById('total-time'),
  audioPlayer: document.createElement('audio'), // Hidden audio element
  
  // Details elements
  status: document.getElementById('status'),
  duration: document.getElementById('duration'),
  fileSize: document.getElementById('file-size'),
  fileType: document.getElementById('file-type'),
  importance: document.getElementById('importance'),
  sentiment: document.getElementById('sentiment'),
  actions: document.getElementById('actions'),
  followUp: document.getElementById('follow-up'),
  topics: document.getElementById('topics'),
  keywords: document.getElementById('keywords'),
  language: document.getElementById('language'),
  speakers: document.getElementById('speakers'),
  summaryStatus: document.getElementById('summary-status'),
  
  // Tab elements
  tabButtons: document.querySelectorAll('[role="tab"]'),
  tabPanes: document.querySelectorAll('[role="tabpanel"]'),
  
  // Content containers
  transcriptContainer: document.querySelector('#transcript'),
  summaryContainer: document.querySelector('#summary'),
  timelineContainer: document.querySelector('#timeline'),
  actionsContainer: document.querySelector('#actions'),
  
  // Insights panel
  insightsPanel: document.getElementById('insights-panel'),
  insightsToggleBtn: document.getElementById('toggle-insights-btn'),
  insightsText: document.getElementById('insights-text'),
  insightsIcon: document.getElementById('insights-icon'),
  
  // Sidebar
  sidebarContainer: document.getElementById('sidebar-container'),
  
  // Action buttons
  generateTranscriptBtn: null, // Will be set after page loads
  generateSummaryBtn: null,    // Will be set after page loads
  generateTimelineBtn: null,   // Will be set after page loads
  generateActionsBtn: null,    // Will be set after page loads
  backButton: document.querySelector('.back-button')
};

// State
let recordingData = null;
let recordingId = null;
let isPlaying = false;
let currentAudioTime = 0;
let audioLoaded = false;
let audioUpdateInterval = null;
let insightsVisible = true;

// Initialize the page
async function initializeRecordingDetails() {
  try {
    // Load sidebar
    await loadSidebar();
    
    // Get recording ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    recordingId = urlParams.get('id');
    
    if (!recordingId) {
      showError('No recording ID provided');
      return;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Load recording details
    await loadRecordingDetails();
    
    // Generate waveform visualization
    generateWaveform();
  } catch (error) {
    console.error('Error initializing recording details:', error);
    showError('Error initializing page: ' + error.message);
  }
}

// Load the sidebar
async function loadSidebar() {
  try {
    const sidebarResponse = await fetch('../components/sidebar.html');
    const sidebarHtml = await sidebarResponse.text();
    elements.sidebarContainer.innerHTML = sidebarHtml;
    
    if (typeof window.initializeSidebar === 'function') {
      window.initializeSidebar('recordings');
    }
  } catch (error) {
    console.error('Error loading sidebar:', error);
    elements.sidebarContainer.innerHTML = '<div class="p-3">Error loading sidebar</div>';
  }
}

// Set up event listeners
function setupEventListeners() {
  // Back button
  if (elements.backButton) {
    elements.backButton.addEventListener('click', () => {
      window.location.href = 'dashboard.html';
    });
  }
  
  // Play/pause button
  elements.playPauseBtn.addEventListener('click', togglePlayback);
  
  // Download button
  elements.downloadBtn.addEventListener('click', downloadRecording);
  
  // Tab switching
  elements.tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      switchTab(button.getAttribute('data-bs-target'));
    });
  });
  
  // Audio player events
  elements.audioPlayer.addEventListener('timeupdate', updateAudioProgress);
  elements.audioPlayer.addEventListener('ended', () => {
    isPlaying = false;
    updatePlayPauseUI();
  });
  
  // Waveform click for seeking
  elements.waveform.addEventListener('click', handleWaveformClick);
  
  // Toggle insights panel
  if (elements.insightsToggleBtn) {
    elements.insightsToggleBtn.addEventListener('click', toggleInsightsPanel);
  }
}

// Toggle insights panel
function toggleInsightsPanel() {
  if (!elements.insightsPanel) return;
  
  insightsVisible = !insightsVisible;
  
  if (insightsVisible) {
    elements.insightsPanel.style.display = 'block';
    elements.insightsText.textContent = 'Hide Insights';
    elements.insightsIcon.innerHTML = '<i class="fas fa-chevron-down"></i>';
  } else {
    elements.insightsPanel.style.display = 'none';
    elements.insightsText.textContent = 'Show Insights';
    elements.insightsIcon.innerHTML = '<i class="fas fa-chevron-right"></i>';
  }
}

// Switch between tabs
function switchTab(tabId) {
  // Remove the # if present
  tabId = tabId.replace('#', '');
  
  // Find the corresponding button and pane
  const button = document.querySelector(`[data-bs-target="#${tabId}"]`);
  const pane = document.getElementById(tabId);
  
  if (!button || !pane) return;
  
  // Update active state for buttons
  elements.tabButtons.forEach(btn => {
    btn.classList.remove('active');
    btn.setAttribute('aria-selected', 'false');
  });
  button.classList.add('active');
  button.setAttribute('aria-selected', 'true');
  
  // Update active state for panes
  elements.tabPanes.forEach(p => {
    p.classList.remove('show', 'active');
  });
  pane.classList.add('show', 'active');
}

// Load recording details from the service worker
async function loadRecordingDetails() {
  try {
    // Show loading state
    elements.recordingTitle.textContent = 'Loading...';
    
    // Get recording from service worker
    const recording = await getRecordingById(recordingId);
    
    if (!recording) {
      throw new Error('Recording not found');
    }
    
    recordingData = recording;
    
    // Update UI with recording details
    updateRecordingUI(recording);
    
    // Set up generate buttons with event listeners
    setupGenerateButtons();
    
    // Load audio
    await loadAudio();
    
  } catch (error) {
    console.error('Error loading recording details:', error);
    showError('Failed to load recording details: ' + error.message);
  }
}

// Get recording by ID
function getRecordingById(id) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'getRecordingById', id }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      if (!response?.success) {
        reject(new Error(response?.error || 'Failed to get recording'));
        return;
      }
      
      resolve(response.recording);
    });
  });
}

// Load audio data
async function loadAudio() {
  try {
    const dataUrl = await getRecordingAudio(recordingId);
    elements.audioPlayer.src = dataUrl;
    audioLoaded = true;
  } catch (error) {
    console.error('Error loading audio:', error);
    showError('Failed to load audio: ' + error.message);
  }
}

// Get recording audio
function getRecordingAudio(id) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'getRecordingBlob', id }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      
      if (!response?.success || !response.dataUrl) {
        reject(new Error(response?.error || 'Failed to get audio'));
        return;
      }
      
      resolve(response.dataUrl);
    });
  });
}

// Update UI with recording details
function updateRecordingUI(recording) {
  const metadata = recording.metadata || {};
  const analysis = recording.analysis || {};
  
  // Update header info
  elements.recordingTitle.textContent = metadata.filename || `recording-${recording.id}.webm`;
  elements.recordingDate.textContent = formatDate(metadata.timestamp || new Date());
  
  // Update details section
  if (elements.status) elements.status.textContent = metadata.transcriptionStatus || 'Not Transcribed';
  if (elements.duration) elements.duration.textContent = formatDuration(metadata.duration || 0);
  if (elements.fileSize) elements.fileSize.textContent = formatFileSize(metadata.fileSize || 0);
  if (elements.fileType) elements.fileType.textContent = metadata.mimeType || 'audio/webm';
  
  // Update additional analysis fields
  if (elements.importance) elements.importance.textContent = analysis.importance || 'N/A';
  if (elements.sentiment) elements.sentiment.textContent = analysis.sentiment || 'Neutral';
  if (elements.actions) elements.actions.textContent = analysis.actionItemsCount || '0';
  if (elements.followUp) elements.followUp.textContent = analysis.followUpRequired ? 'Yes' : 'No';
  if (elements.topics) elements.topics.textContent = analysis.topics?.join(', ') || 'N/A';
  if (elements.keywords) elements.keywords.textContent = analysis.keywords?.join(', ') || 'N/A';
  if (elements.language) elements.language.textContent = metadata.detectedLanguage || 'N/A';
  if (elements.speakers) elements.speakers.textContent = metadata.speakerCount || 'N/A';
  if (elements.summaryStatus) elements.summaryStatus.textContent = analysis.summaryStatus || 'Not Generated';
  
  // Update total time
  elements.totalTime.textContent = formatDuration(metadata.duration || 0);
}

// Generate waveform visualization
function generateWaveform() {
  elements.waveform.innerHTML = '';
  
  // Generate random bars for the waveform
  const numberOfBars = 150;
  for (let i = 0; i < numberOfBars; i++) {
    const height = Math.floor(20 + Math.random() * 60); // Random height between 20 and 80 pixels
    const bar = document.createElement('div');
    bar.className = 'waveform-bar';
    bar.style.height = `${height}%`;
    bar.style.opacity = '0.7';
    elements.waveform.appendChild(bar);
  }
}

// Set up generate buttons with event listeners
function setupGenerateButtons() {
  // Transcript button
  elements.generateTranscriptBtn = document.getElementById('generate-transcript-btn');
  if (elements.generateTranscriptBtn) {
    elements.generateTranscriptBtn.addEventListener('click', generateTranscript);
  }
  
  // Summary button
  elements.generateSummaryBtn = document.getElementById('generate-summary-btn');
  if (elements.generateSummaryBtn) {
    elements.generateSummaryBtn.addEventListener('click', generateSummary);
  }
  
  // Timeline button
  elements.generateTimelineBtn = document.getElementById('generate-timeline-btn');
  if (elements.generateTimelineBtn) {
    elements.generateTimelineBtn.addEventListener('click', generateTimeline);
  }
  
  // Actions button
  elements.generateActionsBtn = document.getElementById('generate-actions-btn');
  if (elements.generateActionsBtn) {
    elements.generateActionsBtn.addEventListener('click', generateActions);
  }
}

// Toggle audio playback
function togglePlayback() {
  if (!audioLoaded) {
    showError('Audio not loaded yet');
    return;
  }
  
  if (isPlaying) {
    elements.audioPlayer.pause();
  } else {
    elements.audioPlayer.play()
      .catch(error => {
        console.error('Playback error:', error);
        showError('Could not play audio: ' + error.message);
      });
  }
  
  isPlaying = !isPlaying;
  updatePlayPauseUI();
}

// Update the play/pause button UI
function updatePlayPauseUI() {
  if (isPlaying) {
    elements.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
  } else {
    elements.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
  }
}

// Update audio progress
function updateAudioProgress() {
  currentAudioTime = elements.audioPlayer.currentTime;
  const formattedTime = formatDuration(currentAudioTime * 1000);
  elements.currentTime.textContent = formattedTime;
  
  // Update waveform progress indicator (could be enhanced later)
}

// Handle click on waveform for seeking
function handleWaveformClick(event) {
  if (!audioLoaded) return;
  
  const rect = elements.waveform.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const percentage = clickX / rect.width;
  
  // Calculate new time position
  const duration = elements.audioPlayer.duration;
  const newTime = percentage * duration;
  
  // Set new time
  elements.audioPlayer.currentTime = newTime;
  updateAudioProgress();
}

// Download recording
function downloadRecording() {
  if (!recordingData || !recordingData.id) {
    showError('No recording data available for download');
    return;
  }
  
  chrome.runtime.sendMessage({ 
    action: 'downloadRecording', 
    id: recordingData.id 
  }, (response) => {
    if (chrome.runtime.lastError || !response?.success) {
      showError('Failed to download recording: ' + (response?.error || 'Unknown error'));
    }
  });
}

// Generate transcript
function generateTranscript() {
  // Show loading state
  const button = elements.generateTranscriptBtn;
  const originalText = button.textContent;
  button.textContent = 'Generating...';
  button.disabled = true;
  
  // Simulate transcript generation (would be replaced with actual API call)
  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
    
    // Show demo/mock content instead of empty state
    elements.transcriptContainer.innerHTML = `
      <div class="p-4 bg-light rounded mb-4">
        <strong>Demo Mode:</strong> This is a simulated transcript. In the actual extension, 
        this would contain the real transcript from the recording.
      </div>
      <div class="transcript-section">
        <div class="p-3 mb-3 border-bottom">
          <div class="d-flex align-items-center mb-2">
            <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-2" 
                 style="width: 36px; height: 36px;">S1</div>
            <div>
              <div class="fw-bold">Speaker 1</div>
              <small class="text-muted">00:00 - 00:10</small>
            </div>
          </div>
          <p>Hello and welcome to the meeting. Today we'll be discussing the new project timeline.</p>
        </div>
        
        <div class="p-3 mb-3 border-bottom">
          <div class="d-flex align-items-center mb-2">
            <div class="rounded-circle bg-info text-white d-flex align-items-center justify-content-center me-2" 
                 style="width: 36px; height: 36px;">S2</div>
            <div>
              <div class="fw-bold">Speaker 2</div>
              <small class="text-muted">00:10 - 00:20</small>
            </div>
          </div>
          <p>Thanks for the introduction. I'd like to start by sharing some updates on our progress so far.</p>
        </div>
      </div>
    `;
  }, 2000);
}

// Generate summary
function generateSummary() {
  // Show loading state
  const button = elements.generateSummaryBtn;
  const originalText = button.textContent;
  button.textContent = 'Generating...';
  button.disabled = true;
  
  // Simulate summary generation (would be replaced with actual API call)
  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
    
    // Show demo/mock content instead of empty state
    elements.summaryContainer.innerHTML = `
      <div class="p-4 bg-light rounded mb-4">
        <strong>Demo Mode:</strong> This is a simulated summary. In the actual extension, 
        this would contain a real AI-generated summary of the meeting.
      </div>
      
      <div class="card mb-4">
        <div class="card-header">
          <h5 class="mb-0">Meeting Summary</h5>
        </div>
        <div class="card-body">
          <h6>Key Points</h6>
          <ul>
            <li>Project timeline was discussed with focus on upcoming milestones</li>
            <li>Current progress was reviewed and determined to be on track</li>
            <li>Resource allocation for the next phase was agreed upon</li>
          </ul>
          
          <h6 class="mt-4">Action Items</h6>
          <div class="p-3 bg-warning bg-opacity-10 rounded border border-warning border-opacity-25">
            <div class="d-flex">
              <i class="fas fa-flag text-warning me-2 mt-1"></i>
              <div>
                <p class="fw-medium mb-1">Schedule follow-up meeting</p>
                <p class="text-muted small mb-0">Review progress next week and adjust timeline if needed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }, 2000);
}

// Generate timeline
function generateTimeline() {
  // Show loading state
  const button = elements.generateTimelineBtn;
  const originalText = button.textContent;
  button.textContent = 'Generating...';
  button.disabled = true;
  
  // Simulate timeline generation (would be replaced with actual API call)
  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
    
    // Show demo/mock content instead of empty state
    elements.timelineContainer.innerHTML = `
      <div class="p-4 bg-light rounded mb-4">
        <strong>Demo Mode:</strong> This is a simulated timeline. In the actual extension, 
        this would contain an interactive timeline of the meeting.
      </div>
      
      <div class="mb-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h5 class="mb-0">Meeting Timeline</h5>
          <div class="d-flex">
            <input type="text" class="form-control form-control-sm me-2" placeholder="Search timeline...">
            <button class="btn btn-sm btn-outline-secondary">
              <i class="fas fa-filter"></i>
            </button>
          </div>
        </div>
        
        <div class="timeline-view">
          <div class="d-flex p-2 bg-light border-bottom">
            <div class="col-2"><strong>Time</strong></div>
            <div class="col-2"><strong>Speaker</strong></div>
            <div class="col-6"><strong>Content</strong></div>
            <div class="col-2"><strong>Type</strong></div>
          </div>
          
          <div class="d-flex p-2 border-bottom hover-bg-light">
            <div class="col-2">00:00</div>
            <div class="col-2">Speaker 1</div>
            <div class="col-6">Hello and welcome to the meeting. Today we'll be discussing the new project timeline.</div>
            <div class="col-2"><span class="badge bg-primary">Introduction</span></div>
          </div>
          
          <div class="d-flex p-2 border-bottom hover-bg-light">
            <div class="col-2">00:10</div>
            <div class="col-2">Speaker 2</div>
            <div class="col-6">Thanks for the introduction. I'd like to start by sharing some updates.</div>
            <div class="col-2"><span class="badge bg-info">Update</span></div>
          </div>
          
          <div class="d-flex p-2 border-bottom hover-bg-light">
            <div class="col-2">00:20</div>
            <div class="col-2">Speaker 1</div>
            <div class="col-6">What's our current status on the first milestone?</div>
            <div class="col-2"><span class="badge bg-purple">Question</span></div>
          </div>
          
          <div class="d-flex p-2 border-bottom hover-bg-light">
            <div class="col-2">00:30</div>
            <div class="col-2">Speaker 2</div>
            <div class="col-6">We've completed about 80% of the first milestone tasks.</div>
            <div class="col-2"><span class="badge bg-success">Response</span></div>
          </div>
          
          <div class="d-flex p-2 border-bottom hover-bg-light">
            <div class="col-2">00:45</div>
            <div class="col-2">Speaker 1</div>
            <div class="col-6">Let's schedule a follow-up meeting next week to review progress.</div>
            <div class="col-2"><span class="badge bg-warning">Action Item</span></div>
          </div>
        </div>
      </div>
    `;
  }, 2000);
}

// Generate actions
function generateActions() {
  // Show loading state
  const button = elements.generateActionsBtn;
  const originalText = button.textContent;
  button.textContent = 'Generating...';
  button.disabled = true;
  
  // Simulate actions generation (would be replaced with actual API call)
  setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
    
    // Show demo/mock content instead of empty state
    elements.actionsContainer.innerHTML = `
      <div class="p-4 bg-light rounded mb-4">
        <strong>Demo Mode:</strong> This is a simulated actions list. In the actual extension, 
        this would contain real extracted action items from the meeting.
      </div>
      
      <div class="card mb-4">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5 class="mb-0">Action Items</h5>
          <button class="btn btn-sm btn-outline-primary">Export to Task Manager</button>
        </div>
        <div class="card-body">
          <div class="action-item mb-3 p-3 border rounded">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h6 class="mb-0">Schedule follow-up meeting</h6>
              <span class="badge bg-info">High Priority</span>
            </div>
            <p class="text-muted mb-2">Review progress next week and adjust timeline if needed</p>
            <div class="d-flex justify-content-between align-items-center">
              <small class="text-muted">Owner: Speaker 1</small>
              <small class="text-muted">Due: In 7 days</small>
            </div>
          </div>
          
          <div class="action-item mb-3 p-3 border rounded">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <h6 class="mb-0">Complete milestone documentation</h6>
              <span class="badge bg-warning">Medium Priority</span>
            </div>
            <p class="text-muted mb-2">Finalize documentation for the first milestone</p>
            <div class="d-flex justify-content-between align-items-center">
              <small class="text-muted">Owner: Speaker 2</small>
              <small class="text-muted">Due: In 3 days</small>
            </div>
          </div>
        </div>
      </div>
    `;
  }, 2000);
}

// Helper functions
function formatDate(dateString) {
  if (!dateString) return 'Invalid Date';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDuration(ms) {
  if (typeof ms !== 'number' || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
  if (bytes == null || typeof bytes !== 'number' || bytes < 0) {
    return '0 KB';
  }
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // Ensure i is within bounds of sizes array
  const index = Math.min(i, sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, index)).toFixed(1)) + ' ' + sizes[index];
}

// Show error message
function showError(message) {
  alert(message);
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeRecordingDetails);
