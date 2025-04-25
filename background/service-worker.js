// Import necessary functions from the offscreen manager module
import * as offscreenManager from './offscreen-manager.js';

// Import database manager functions
import * as dbManager from './db-manager.js';

// Import transcription manager functions
import * as transcriptionManager from './transcription-manager.js';

// DEBUG: Add top-level connect listener to catch ALL port connections
chrome.runtime.onConnect.addListener(port => {
  console.warn('[SW-GLOBAL] 🔌 onConnect fired at top level, port.name=', port.name);
  // Don't do anything with the port, just log it - offscreenManager will handle actual connections
});

// Make them globally available for whisper-integration.js to use
// globalThis.TranscriptionService = TranscriptionService;
// globalThis.TRANSCRIPTION_PROVIDER = TRANSCRIPTION_PROVIDER;

// Import Whisper integration - using type="module" in manifest.json
// import { processRecording, saveTranscriptionResult, setupDatabaseAccess } from './whisper-integration.js';

// Track ongoing transcription requests
let transcriptionRequestMap = new Map();

// Track if side panel is open
let sidePanelOpen = false;

// Keep track of the popup window (for fallback)
let popupWindowId = null;

// Listen for browser action clicks - open side panel instead of popup
chrome.action.onClicked.addListener(async (tab) => {
  console.log('[ServiceWorker] Action clicked, toggling side panel');
  
  try {
    // Get the current state of the side panel
    const sidePanel = await chrome.sidePanel.getOptions({ tabId: tab.id });
    
    if (sidePanel && sidePanel.enabled) {
      // Side panel is already open, close it
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        enabled: false
      });
      console.log('[ServiceWorker] Closed side panel');
      sidePanelOpen = false;
    } else {
      // Open the side panel
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: 'popup/popup.html',
        enabled: true
      });
      console.log('[ServiceWorker] Opened side panel');
      sidePanelOpen = true;
    }
  } catch (error) {
    console.error('[ServiceWorker] Error toggling side panel:', error);
    
    // Fallback to using a popup window if side panel fails
    console.log('[ServiceWorker] Falling back to popup window');
    openPopupWindow();
  }
});

// Fallback function to open a popup window if side panel isn't supported
function openPopupWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup/popup.html'),
    type: 'popup',
    width: 400,
    height: 600,
    left: 1500,
    top: 100,
    focused: true
  }).then(window => {
    console.log('[ServiceWorker] Created popup window as fallback:', window.id);
    popupWindowId = window.id;
    
    // Monitor window removal
    const handleWindowRemoved = (removedWindowId) => {
      if (removedWindowId === popupWindowId) {
        console.log('[ServiceWorker] Popup window was closed');
        popupWindowId = null;
        chrome.windows.onRemoved.removeListener(handleWindowRemoved);
      }
    };
    
    chrome.windows.onRemoved.addListener(handleWindowRemoved);
  }).catch(error => {
    console.error('[ServiceWorker] Error creating fallback popup window:', error);
  });
}

// --- Central Message Listener --- 
// Combined listener for messages from popup, content scripts, and forwarded from offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Special handling for popup initialization
  if (message && message.type === 'POPUP_INITIALIZED') {
    console.log('[ServiceWorker] Popup initialized, sending initialization data');
    // Respond with any initialization data the popup needs
    sendResponse({ 
      success: true, 
      initialized: true,
      offscreenStatus: offscreenManager.getReadyState(),
      // Add any other data the popup needs to initialize
    });
    return true; // Keep the channel open for async response
  }

  // Ensure debug log/dom requests go to offscreen document, not handled by SW
  if (message && (message.type === 'GET_DEBUG_LOGS' || message.type === 'GET_DEBUG_DOM')) {
    console.log('[ServiceWorker] Forwarding debug request to offscreen document');
    // Let offscreen handle these
    return false;
  }

  console.log('[ServiceWorker] Received chrome.runtime message:', message, 'from:', sender.tab ? `Tab ${sender.tab.id}` : "Popup/Extension");

  // Handle forwarded messages from OffscreenManager first
  if (message.type === 'TRANSCRIPTION_RESULT') {
    transcriptionManager.handleTranscriptionResult(message)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error("[ServiceWorker] Error handling transcription result:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Indicate async response
  }
  
  if (message.type === 'TRANSCRIPTION_ERROR') {
    transcriptionManager.handleTranscriptionError(message)
      .then(() => sendResponse({ success: true }))
      .catch(err => {
        console.error("[ServiceWorker] Error handling transcription error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Indicate async response
  }
  
  // Handle debug messages from our debug-helper.js
  if (message && message.type === 'OFFSCREEN_DEBUG') {
    // Forward to appropriate handlers or log
    console.log('[ServiceWorker] Received debug message:', message);
    // If this is a keep-alive message, send immediate response
    if (message.action === 'MANUAL_KEEPALIVE') {
      sendResponse({ success: true, received: true });
    }
    return false; // Let other listeners handle it too
  }

  // --- Actions from Popup/Content Scripts --- 
  if (message && message.action) {
    switch (message.action) {
      case 'getInitialState':
        // Combine current runtime state with stored settings
        chrome.storage.sync.get('settings', (data) => {
          let settings = data.settings || {
            // Default settings
            theme: 'light',
            notifications: true
          };
          
          // Get offscreen document status
          offscreenManager.getReadyState().then(readyState => {
            sendResponse({
              success: true,
              settings: settings,
              offscreenReady: readyState.ready,
              initialized: true
            });
          }).catch(err => {
            console.error('[ServiceWorker] Error getting offscreen ready state:', err);
            sendResponse({
              success: true,
              settings: settings,
              offscreenReady: false,
              initialized: true,
              error: err.message
            });
          });
        });
        return true; // Keep channel open for async response

      case 'closePopup':
        console.log('[ServiceWorker] Received legacy request to close popup window');
        if (popupWindowId) {
          chrome.windows.remove(popupWindowId).then(() => {
            console.log('[ServiceWorker] Closed popup window (legacy method)');
            popupWindowId = null;
            sendResponse({ success: true });
          }).catch(error => {
            console.error('[ServiceWorker] Error closing popup window (legacy):', error);
            sendResponse({ success: false, error: error.message });
            // Reset the ID anyway in case the window was already closed
            popupWindowId = null;
          });
        } else {
          console.log('[ServiceWorker] No popup window to close (legacy)');
          sendResponse({ success: false, error: 'No popup window exists' });
        }
        return true; // Keep the message channel open for async response

      case 'closePopupWindow':
        console.log('[ServiceWorker] Received request to close popup window');
        if (popupWindowId) {
          chrome.windows.remove(popupWindowId).then(() => {
            console.log('[ServiceWorker] Closed popup window');
            popupWindowId = null;
            sendResponse({ success: true });
          }).catch(error => {
            console.error('[ServiceWorker] Error closing popup window:', error);
            sendResponse({ success: false, error: error.message });
            // Reset the ID anyway in case the window was already closed
            popupWindowId = null;
          });
        } else {
          console.log('[ServiceWorker] No popup window to close');
          sendResponse({ success: false, error: 'No popup window exists' });
        }
        return true; // Keep the message channel open for async response

      case 'hideSidePanel':
        console.log('[ServiceWorker] Received request to hide side panel');
        // Get the tab ID from the message or try to get the active tab
        if (message.tabId) {
          // Use the provided tab ID
          console.log(`[ServiceWorker] Using provided tab ID: ${message.tabId}`);
          tryHideSidePanel(message.tabId, sendResponse);
        } else {
          // Get the active tab and hide its side panel
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
              const tabId = tabs[0].id;
              console.log(`[ServiceWorker] Using active tab ID: ${tabId}`);
              tryHideSidePanel(tabId, sendResponse);
            } else {
              console.error('[ServiceWorker] No active tab found to hide side panel');
              sendResponse({ success: false, error: 'No active tab found' });
            }
          });
        }
        return true; // Keep the message channel open for async response

      case 'openDashboard':
        console.log('[ServiceWorker] Opening dashboard');
        try {
          // Create the dashboard URL (you can modify this to your actual dashboard URL)
          const dashboardUrl = chrome.runtime.getURL('ui/pages/dashboard.html');
          
          // Open the dashboard in a new tab
          chrome.tabs.create({ url: dashboardUrl }, (tab) => {
            if (chrome.runtime.lastError) {
              console.error('[ServiceWorker] Error opening dashboard tab:', chrome.runtime.lastError);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
              console.log('[ServiceWorker] Dashboard opened in tab:', tab.id);
              sendResponse({ success: true, tabId: tab.id });
            }
          });
        } catch (error) {
          console.error('[ServiceWorker] Error opening dashboard:', error);
          sendResponse({ success: false, error: error.message });
        }
        return true; // Keep the message channel open for async response

      case 'getRecordings':
        console.log('[ServiceWorker] Fetching recordings for dashboard with message:', message);
        
        // First make sure the database is initialized
        dbManager.initializeDatabase()
          .then(() => {
            console.log('[ServiceWorker] Database initialized, now getting recordings');
            // Then get all recordings
            return dbManager.getAllRecordings();
          })
          .then(recordings => {
            console.log(`[ServiceWorker] Retrieved ${recordings ? recordings.length : 0} recordings:`, recordings);
            // Send the recordings back to the caller
            sendResponse({ 
              success: true, 
              recordings: recordings || [] 
            });
          })
          .catch(error => {
            console.error('[ServiceWorker] Error retrieving recordings:', error);
            sendResponse({ 
              success: false, 
              error: error ? error.message : 'Unknown database error',
              errorObj: JSON.stringify(error)
            });
          });
        
        return true; // Keep the message channel open for async response

      case 'getRecordingById':
        console.log('[ServiceWorker] Fetching single recording by ID:', message.id);
        
        // Validate the request
        if (!message.id) {
          console.error('[ServiceWorker] Missing recording ID in getRecordingById request');
          sendResponse({ success: false, error: 'Missing recording ID' });
          return true;
        }

        // Initialize database and retrieve the recording
        dbManager.initializeDatabase()
          .then(() => {
            console.log(`[ServiceWorker] Retrieving recording with ID: ${message.id}`);
            return dbManager.getRecordingById(message.id);
          })
          .then(recording => {
            if (!recording) {
              console.error(`[ServiceWorker] Recording not found with ID: ${message.id}`);
              sendResponse({ success: false, error: 'Recording not found' });
              return;
            }

            console.log(`[ServiceWorker] Retrieved recording: ${recording.id}`);
            sendResponse({
              success: true,
              recording: recording
            });
          })
          .catch(error => {
            console.error(`[ServiceWorker] Error retrieving recording by ID: ${message.id}`, error);
            sendResponse({
              success: false,
              error: error ? error.message : 'Unknown database error',
              errorObj: JSON.stringify(error)
            });
          });
        
        return true; // Keep the message channel open for async response

      case 'getTimelineData':
        console.log('[ServiceWorker] Received getTimelineData request:', message);
        const timelineRecordingId = message.recordingId;
        
        if (!timelineRecordingId) {
          console.error('[ServiceWorker] Missing recordingId in getTimelineData request');
          sendResponse({ success: false, error: 'Missing recording ID' });
          return true;
        }

        // Check if we should use mock data (for development/testing)
        if (message.useMockData) {
          console.log(`[ServiceWorker] Using mock data for timeline view of recording: ${timelineRecordingId}`);
          // Get mock data from the fetchTimelineDataFromBackend function
          const mockData = fetchTimelineDataFromBackend(timelineRecordingId);
          sendResponse({
            success: true,
            data: mockData
          });
          return true;
        }
        
        // Otherwise get real data from the database
        dbManager.initializeDatabase()
          .then(() => {
            console.log(`[ServiceWorker] Getting timeline data for recording: ${timelineRecordingId}`);
            return dbManager.getRecordingById(timelineRecordingId);
          })
          .then(recording => {
            if (!recording) {
              console.error(`[ServiceWorker] Recording not found for timeline: ${timelineRecordingId}`);
              sendResponse({ success: false, error: 'Recording not found' });
              return;
            }
            
            // Transform recording data to the format expected by the timeline
            const timelineData = {
              id: recording.id,
              audio: {
                url: recording.audioDataUrl || null
              },
              metadata: recording.metadata || {},
              transcription: recording.transcription || {},
              // If no transcription yet, create a simple timeline 
              timeline: recording.timeline || [
                {
                  type: 'recording_start',
                  timestamp: recording.timestamp || Date.now(),
                  content: 'Recording started'
                },
                {
                  type: 'recording_end',
                  timestamp: (recording.timestamp || Date.now()) + (recording.metadata?.duration || 30000),
                  content: 'Recording ended'
                }
              ]
            };
            
            console.log('[ServiceWorker] Sending timeline data to page');
            sendResponse({
              success: true,
              data: timelineData
            });
          })
          .catch(error => {
            console.error(`[ServiceWorker] Error getting timeline data for recording: ${timelineRecordingId}`, error);
            sendResponse({
              success: false,
              error: error ? error.message : 'Failed to get timeline data'
            });
          });
          
        return true; // Keep the message channel open for async response

      // --- Transcription Initiation --- 
      case 'startTranscription':
        const { audioDataUrl: transcribeUrl, requestId: transcribeId } = message.payload || {};
        if (!transcribeUrl || !transcribeId) {
          console.error('[ServiceWorker] Invalid startTranscription payload:', message.payload);
          sendResponse({ success: false, error: 'Missing audioDataUrl or requestId' });
          return false;
        }
        
        transcriptionManager.transcribeAudio(transcribeUrl, transcribeId)
          .then(() => {
            // Acknowledge the request was received and is being processed
            // The actual result/error comes later via separate messages
            sendResponse({ success: true, message: 'Transcription process initiated' });
          })
          .catch(err => {
            // This catch is for errors *initiating* the process (e.g., offscreen unavailable)
            console.error('[ServiceWorker] Error initiating transcription:', err);
            sendResponse({ success: false, error: `Failed to start transcription: ${err.message}` });
          });
        return true; // Indicate async response

      case 'getTranscriptionStatus':
        const { requestId: statusRequestId } = message.payload || {};
        if (!statusRequestId) {
          sendResponse({ success: false, error: 'Missing requestId' });
          return false;
        }
        
        const status = transcriptionManager.getTranscriptionStatus(statusRequestId);
        sendResponse({ success: true, status: status });
        return false; // Synchronous response
        
      case 'getAllTranscriptionRequests':
        const requests = transcriptionManager.getAllTranscriptionRequests();
        sendResponse({ success: true, requests: requests });
        return false; // Synchronous response

      case 'saveRecordingData': 
        console.log('[ServiceWorker] Received saveRecordingData request', message);
        // --- Expect metadata and audioDataUrl --- 
        const { metadata, audioDataUrl } = message.data || {};
        
        if (!metadata || !audioDataUrl) {
          console.error('[ServiceWorker] Missing metadata or audioDataUrl in saveRecordingData request', message);
          sendResponse({ success: false, error: 'Missing required data in recording request' });
          return true;
        }
        
        console.log('[ServiceWorker] Processing recording data with metadata:', metadata);
        
        // Process the audio data and save it to the database
        (async () => {
          try {
            // Generate a unique ID for the recording
            const uniqueId = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Create the recording object - ensure it has the required structure for the DB
            const recordingData = {
              id: uniqueId,
              metadata: {
                ...metadata,
                title: metadata.title || `Recording ${new Date().toLocaleString()}`,
                duration: metadata.duration || 0,
                fileSize: metadata.fileSize || (audioDataUrl.length * 0.75), // Rough estimate of base64 size
                timestamp: metadata.timestamp || Date.now(),
                type: metadata.type || 'audio/mp3'
              },
              audioDataUrl: audioDataUrl,
              timestamp: Date.now()
            };
            
            console.log(`[ServiceWorker] Saving recording with ID: ${uniqueId}, size: ${recordingData.metadata.fileSize} bytes`);
            
            // Initialize database before saving
            await dbManager.initializeDatabase();
            
            // Save to database using the db manager
            const savedRecordingId = await dbManager.saveRecording(recordingData);
            console.log(`[ServiceWorker] Recording saved successfully with ID: ${savedRecordingId}`);
            
            // Send success response
            sendResponse({ success: true, id: savedRecordingId });
          } catch (error) {
            console.error('[ServiceWorker] Error saving recording:', error);
            sendResponse({ success: false, error: error.message || 'Failed to save recording' });
          }
        })();
        return true; // Keep channel open for async response

      case 'getRecordings':
        (async () => {
          try {
            // Get all recordings using the db manager
            const recordings = await dbManager.getAllRecordings();
            
            // Process recordings to remove large data fields
            const processedRecordings = recordings.map(recording => {
              // Create a copy without the audioDataUrl to reduce payload size
              const { audioDataUrl, ...recordingWithoutAudio } = recording;
              return recordingWithoutAudio;
            });
            
            sendResponse({ success: true, recordings: processedRecordings });
          } catch (error) {
            console.error("[ServiceWorker] getRecordings error:", error);
            sendResponse({ success: false, error: error.message || 'Failed to get recordings' });
          }
        })();
        return true; // Keep channel open for async response

      case 'getRecordingBlob':
        console.log(`[ServiceWorker] getRecordingBlob request:`, message);
        // Get ID from any possible source (we have multiple ID formats in the system)
        const recordingId = message.id || 
                          message.recordingId || 
                          (message.data && message.data.recordingId) || 
                          (message.data && message.data.id);
        
        console.log(`[ServiceWorker] Attempting to retrieve recording with ID: ${recordingId}`);
        
        if (!recordingId) {
          console.error('[ServiceWorker] No recording ID provided for getRecordingBlob');
          sendResponse({ error: 'No recording ID provided' });
          return true;
        }
        
        // Get the recording from the database
        dbManager.getRecordingById(recordingId)
          .then(recording => {
            if (!recording) {
              console.log(`[ServiceWorker] Recording not found with ID: ${recordingId}, trying alternative ID formats...`);
              
              // Try with a fallback query to find by partial ID match
              return dbManager.getAllRecordings()
                .then(allRecordings => {
                  // Find a recording that contains the requested ID (partial match)
                  const matchedRecording = allRecordings.find(rec => 
                    rec.id.includes(recordingId) || (recordingId.includes(rec.id))
                  );
                  
                  if (matchedRecording) {
                    console.log(`[ServiceWorker] Found recording via alternative matching: ${matchedRecording.id}`);
                    return matchedRecording;
                  }
                  
                  throw new Error(`Recording with ID ${recordingId} not found`);
                });
            }
            
            return recording;
          })
          .then(recording => {
            console.log(`[ServiceWorker] Found recording, returning data URL of length: ${recording.audioDataUrl ? recording.audioDataUrl.length : 0}`);
            
            // Send the audio data URL back - using dataUrl key to match popup.js expectations
            sendResponse({ 
              success: true, 
              dataUrl: recording.audioDataUrl
            });
          })
          .catch(error => {
            console.error('[ServiceWorker] Error getting recording blob:', error);
            sendResponse({ 
              success: false,
              error: error.message || 'Failed to get recording' 
            });
          });
        
        return true;

      case 'getRecordings':
        console.log('[ServiceWorker] Getting all recordings');
        
        // Get all recordings from the database via db-manager
        dbManager.getAllRecordings()
          .then(recordings => {
            console.log(`[ServiceWorker] Retrieved ${recordings.length} recordings`);
            // Send the recordings list back to the popup
            sendResponse({ 
              success: true, 
              recordings: recordings 
            });
          })
          .catch(error => {
            console.error('[ServiceWorker] Error getting recordings:', error);
            sendResponse({ 
              success: false, 
              error: error.message || 'Failed to get recordings' 
            });
          });
        
        // Return true to indicate that sendResponse will be called asynchronously
        return true;
        
      case 'getRecordingDetails':
        console.log('[ServiceWorker] Getting recording details:', message.recordingId);
        
        if (!message.recordingId) {
          console.error('[ServiceWorker] No recording ID provided for getRecordingDetails');
          sendResponse({ error: 'No recording ID provided' });
          return true;
        }
        
        // Get the specific recording from the database
        dbManager.getRecordingById(message.recordingId)
          .then(recording => {
            if (!recording) {
              throw new Error(`Recording with ID ${message.recordingId} not found`);
            }
            
            // Send the recording details back
            sendResponse({ 
              success: true, 
              recording: recording 
            });
          })
          .catch(error => {
            console.error('[ServiceWorker] Error getting recording details:', error);
            sendResponse({ error: error.message || 'Failed to get recording details' });
          });
        
        // Return true to indicate that sendResponse will be called asynchronously
        return true;
        
      case 'deleteRecording':
        console.log('[ServiceWorker] Deleting recording:', message.recordingId);
        
        if (!message.recordingId) {
          console.error('[ServiceWorker] No recording ID provided for deletion');
          sendResponse({ 
            success: false, 
            error: 'No recording ID provided' 
          });
          return true;
        }
        
        // Delete the recording from the database using the dbManager
        dbManager.deleteRecording(message.recordingId)
          .then(success => {
            console.log(`[ServiceWorker] Recording deletion ${success ? 'successful' : 'failed'}: ${message.recordingId}`);
            sendResponse({ 
              success: success,
              message: success ? 'Recording deleted successfully' : 'Failed to delete recording'
            });
          })
          .catch(error => {
            console.error('[ServiceWorker] Error deleting recording:', error);
            sendResponse({ 
              success: false, 
              error: error.message || 'Error deleting recording' 
            });
          });
        
        // Return true to indicate that sendResponse will be called asynchronously
        return true;
        
      case 'downloadRecording':
        const { recordingId: downloadRecordingId } = message.data;
        (async () => {
          try {
            // Get the recording by ID
            const recording = await dbManager.getRecordingById(downloadRecordingId);
            if (!recording) {
              throw new Error('Recording not found');
            }
            
            // Send back the audio data URL
            sendResponse({ 
              success: true, 
              audioDataUrl: recording.audioDataUrl,
              filename: recording.metadata?.filename || `recording_${downloadRecordingId}.webm`
            });
          } catch (error) {
            console.error(`[ServiceWorker] downloadRecording error for ${downloadRecordingId}:`, error);
            sendResponse({ success: false, error: error.message || 'Unknown error downloading recording' });
          }
        })();
        return true; // Keep channel open for async response

      case 'debug_testOffscreenConnection':
        console.log('[ServiceWorker] Testing offscreen connection');
        offscreenManager.ensureOffscreenDocument()
          .then(success => {
            if (success) {
              return offscreenManager.whenOffscreenReady(5000);
            }
            return false;
          })
          .then(ready => {
            sendResponse({ success: true, ready: ready });
          })
          .catch(err => {
            console.error('[ServiceWorker] Error testing offscreen connection:', err);
            sendResponse({ success: false, error: err.message });
          });
        return true;

      case 'INIT_OFFSCREEN_TRANSCRIBER':
        console.log('[ServiceWorker] Initializing offscreen transcriber via runtime message');
        // Send immediate acknowledgment
        sendResponse({ received: true }); 

        // Use the transcription manager to initialize the system
        transcriptionManager.initializeTranscriptionSystem(message.modelSize || 'base')
          .then(success => {
            console.log(`[ServiceWorker] Transcription system initialization ${success ? 'succeeded' : 'failed'}`);
          })
          .catch(err => {
            console.error('[ServiceWorker] Error during transcription system initialization:', err);
          });
        break; 

      case 'debug_createOffscreen':
        console.log('[ServiceWorker] Debug: Creating offscreen via manager');
        offscreenManager.ensureOffscreenDocument()
          .then(success => sendResponse({ success }))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;

      case 'debug_closeOffscreen':
        console.log('[ServiceWorker] Debug: Closing offscreen via manager');
        offscreenManager.closeOffscreenDocument()
          .then(success => sendResponse({ success }))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;

      case 'debug_getOffscreenStatus':
        console.log('[ServiceWorker] Debug: Getting offscreen status via manager');
        Promise.all([
          offscreenManager.hasOffscreenDocument(),
          offscreenManager.getReadyState()
        ]).then(([exists, state]) => {
          sendResponse({ success: true, exists: exists, readyState: state });
        }).catch(err => sendResponse({ success: false, error: err.message }));
        return true;

      case 'debug_resetConnection':
        console.log('[ServiceWorker] Debug: Resetting connection state via manager');
        offscreenManager.resetOffscreenState();
        sendResponse({ success: true, message: 'Connection state reset initiated' });
        break;

      case 'debug_pingOffscreen':
        console.log('[ServiceWorker] Debug: Pinging offscreen via manager');
        offscreenManager.postMessageToOffscreen({ type: 'PING' })
          .then(sent => sendResponse({ success: sent }))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true;

      case 'debug_manualInitWhisper':
        console.log('[ServiceWorker] Debug: Manually initializing Whisper transcriber');
        transcriptionManager.initializeTranscriptionSystem(message.modelSize || 'base')
          .then(success => {
            sendResponse({ success: success, modelSize: message.modelSize || 'base' });
          })
          .catch(err => {
            console.error('[ServiceWorker] Error in manual Whisper init:', err);
            sendResponse({ success: false, error: err.message });
          });
        return true;

      case 'debug_directTranscribe':
        console.log('[ServiceWorker] Debug: Directly transcribing audio without offscreen communication');
        (async () => {
          try {
            const { audioDataUrl, requestId } = message;
            
            if (!audioDataUrl) {
              sendResponse({ success: false, error: 'No audio data provided' });
              return;
            }
            
            console.log(`[ServiceWorker] Direct transcribe request: ${requestId || 'no-id'}, dataUrl length: ${audioDataUrl.length}`);
            
            // Send immediate acknowledgment
            sendResponse({ success: true, received: true });
            
            // Use the mock transcribe function from the transcription manager
            try {
              const result = await transcriptionManager.mockTranscribe(audioDataUrl);
              
              // Send completion event with result
              chrome.runtime.sendMessage({
                type: 'OFFSCREEN_TRANSCRIBER_EVENT',
                event: 'complete',
                requestId: requestId,
                data: result
              }).catch(err => {
                console.error('Error sending completion event:', err);
              });
              
              console.log('[ServiceWorker] Mock transcription completed successfully');
            } catch (transcribeError) {
              console.error('[ServiceWorker] Mock transcription error:', transcribeError);
              
              // Send error event
              chrome.runtime.sendMessage({
                type: 'OFFSCREEN_TRANSCRIBER_EVENT',
                event: 'error',
                requestId: requestId,
                data: {
                  message: transcribeError.message,
                  stack: transcribeError.stack
                }
              }).catch(err => {
                console.error('Error sending error event:', err);
              });
            }
          } catch (error) {
            console.error('[ServiceWorker] Error in direct transcribe:', error);
            sendResponse({ success: false, error: error.message });
          }
        })();
        return true; // Keep the message channel open
      
      default:
        console.warn(`[ServiceWorker] Unhandled message action: ${message.action}`);
        sendResponse({ success: false, error: 'Unknown action' });
        return false;
    }
  } else {
    // Handle messages without an 'action' property if necessary
    console.log('[ServiceWorker] Received message without specific action:', message);
  }
  
  // Return true if you intend to send a response asynchronously, 
  // otherwise return false or undefined.
  return false; 
});

// Listen for runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ServiceWorker] Received message:', message);
  
  // Handle transcription request
  if (message.action === 'transcribeAudio') {
    const { audioDataUrl, requestId, options } = message;
    
    try {
      // Queue transcription
      console.log('[ServiceWorker] Processing transcription request:', requestId);
      
      // Send immediate response to let the client know we received the request
      sendResponse({ status: 'queued', requestId: requestId });
      
      // Pass to transcription manager
      transcriptionManager.handleTranscriptionRequest(audioDataUrl, requestId, options)
        .catch(error => {
          console.error('[ServiceWorker] Error in transcription request:', error);
          // Note: We don't send a response here as the error will be communicated
          // via the TRANSCRIPTION_ERROR message to all listeners
        });
    } catch (error) {
      console.error('[ServiceWorker] Error processing transcription request:', error);
      sendResponse({ 
        status: 'error', 
        requestId: requestId, 
        error: error.message || 'Unknown error processing transcription request'
      });
    }
    
    return true; // Keep channel open for async response
  }
  
  // Handle recording details request
  if (message.action === 'getRecordingDetails') {
    const { recordingId } = message;
    
    // Get recording from database
    dbManager.getRecording(recordingId)
      .then(recording => {
        sendResponse({ recording });
      })
      .catch(error => {
        console.error('[ServiceWorker] Error fetching recording:', error);
        sendResponse({ error: error.message });
      });
    
    return true; // Keep channel open for async response
  }
  
  // Default response for unknown actions
  return false;
});

// Helper function to try hiding the side panel for a given tab ID
function tryHideSidePanel(tabId, sendResponse) {
  chrome.sidePanel.getOptions({ tabId: tabId })
    .then(sidePanel => {
      if (sidePanel && sidePanel.enabled) {
        // Side panel is open, close it
        chrome.sidePanel.setOptions({
          tabId: tabId,
          enabled: false
        })
        .then(() => {
          console.log(`[ServiceWorker] Closed side panel for tab ${tabId}`);
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error(`[ServiceWorker] Error closing side panel for tab ${tabId}:`, error);
          sendResponse({ success: false, error: error.message });
        });
      } else {
        console.log(`[ServiceWorker] Side panel is not open for tab ${tabId}`);
        sendResponse({ success: false, error: 'Side panel is not open' });
      }
    })
    .catch(error => {
      console.error(`[ServiceWorker] Error getting side panel options for tab ${tabId}:`, error);
      sendResponse({ success: false, error: error.message });
    });
}

// Initialize DB and transcription system on startup
Promise.all([
  dbManager.initializeDatabase(),
  transcriptionManager.initializeTranscriptionSystem()
]).then(([dbSuccess, transcriptionSuccess]) => {
  console.log('[ServiceWorker] Initialization complete:');
  console.log(`- Database: ${dbSuccess ? 'Success' : 'Failed'}`);
  console.log(`- Transcription: ${transcriptionSuccess ? 'Success' : 'Failed'}`);
}).catch(error => {
  console.error('[ServiceWorker] Initialization error:', error);
});

// --- Side Panel Logic ---
// Check if we can access the tab
function canAccessTab(tab) {
  return tab && 
         tab.url && 
         (tab.url.startsWith('http:') || 
          tab.url.startsWith('https:') || 
          tab.url.startsWith('file:'));
}

// Toggle side panel in the current tab
async function toggleSidePanel(tab) {
  if (!canAccessTab(tab)) {
    console.warn('[ServiceWorker] Cannot access tab:', tab);
    return false;
  }
  
  try {
    // Check if side panel is already open
    const sidePanel = await chrome.sidePanel.getOptions({ tabId: tab.id });
    
    if (sidePanel && sidePanel.enabled) {
      // Close side panel
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        enabled: false
      });
      console.log(`[ServiceWorker] Closed side panel for tab ${tab.id}`);
      return false;
    } else {
      // Open side panel
      await chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: 'sidepanel/panel.html',
        enabled: true
      });
      console.log(`[ServiceWorker] Opened side panel for tab ${tab.id}`);
      return true;
    }
  } catch (error) {
    console.error('[ServiceWorker] Error toggling side panel:', error);
    return false;
  }
}

// Initialize extension when installed
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[ServiceWorker] Extension installed:', details.reason);
  
  // Initialize default settings
  chrome.storage.sync.get('settings', (data) => {
    if (!data.settings) {
      const defaultSettings = {
        theme: 'light',
        notifications: true,
        autoTranscribe: false,
        modelSize: 'base'
      };
      
      chrome.storage.sync.set({ settings: defaultSettings }, () => {
        console.log('[ServiceWorker] Initialized default settings');
      });
    }
  });
});

// --- MOCK DATA FUNCTION ---
// In a real app, this would fetch from your actual database/storage
async function fetchTimelineDataFromBackend(recordingId) {
  console.log(`[ServiceWorker] Fetching mock timeline data for recording ${recordingId}`);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return mock data
  return {
    id: recordingId,
    title: "Mock Recording",
    duration: 120, // seconds
    timestamp: Date.now() - 3600000, // 1 hour ago
    transcription: {
      text: "This is a mock transcription for testing purposes. It simulates what would be returned from a real transcription service.",
      segments: [{
        id: 0,
        start: 0,
        end: 5.2,
        text: "This is a mock transcription for testing purposes.",
        confidence: 0.95
      }, {
        id: 1,
        start: 5.2,
        end: 10.5,
        text: "It simulates what would be returned from a real transcription service.",
        confidence: 0.92
      }],
      language: "en"
    },
    timeline: [{
      timestamp: Date.now() - 3600000,
      type: "recording_started",
      details: { device: "Chrome Browser" }
    }, {
      timestamp: Date.now() - 3599000,
      type: "speech_detected",
      details: { confidence: 0.8 }
    }, {
      timestamp: Date.now() - 3590000,
      type: "keyword_detected",
      details: { keyword: "testing", confidence: 0.75 }
    }, {
      timestamp: Date.now() - 3580000,
      type: "silence_detected",
      details: { duration: 2.5 }
    }, {
      timestamp: Date.now() - 3570000,
      type: "speech_detected",
      details: { confidence: 0.85 }
    }, {
      timestamp: Date.now() - 3560000,
      type: "keyword_detected",
      details: { keyword: "transcription", confidence: 0.9 }
    }, {
      timestamp: Date.now() - 3550000,
      type: "recording_completed",
      details: { duration: 10 }
    }, {
      timestamp: Date.now() - 3540000,
      type: "transcription_started",
      details: { model: "whisper-base" }
    }, {
      timestamp: Date.now() - 3530000,
      type: "transcription_completed",
      details: { duration: 10, words: 20 }
    }],
    analysis: {
      sentiment: {
        overall: "neutral",
        score: 0.1,
        segments: [{
          start: 0,
          end: 5.2,
          sentiment: "neutral",
          score: 0.05
        }, {
          start: 5.2,
          end: 10.5,
          sentiment: "neutral",
          score: 0.15
        }]
      },
      keywords: [{
        text: "mock",
        count: 1,
        importance: 0.7
      }, {
        text: "transcription",
        count: 2,
        importance: 0.9
      }, {
        text: "testing",
        count: 1,
        importance: 0.8
      }, {
        text: "simulates",
        count: 1,
        importance: 0.6
      }],
      topics: [{
        name: "Testing",
        confidence: 0.85
      }, {
        name: "Transcription",
        confidence: 0.9
      }],
      speakers: [{
        id: "speaker_1",
        segments: [{ start: 0, end: 10.5 }],
        confidence: 0.95
      }]
    }
  };
}

console.log('[ServiceWorker] Service worker script loaded and listeners attached.');
