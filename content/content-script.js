// Audio Transcription Extension - Content Script
// This script runs in the context of web pages

// Note: We don't use ES modules here since content scripts need to run in the web page context
// We'll load the mp3 encoder via a script tag instead

// Global variables
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let sidePanelContainer = null;
let sidePanelVisible = false;
let audioContext = null;
let audioSource = null;
let recordingType = 'tab'; // 'tab', 'mic', or 'both'
let recordingStartTime = null;
let recordingFileName = '';
let sidePanelIframe = null;

// Load lamejs library
function loadLameJsLibrary() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.lamejs) {
      resolve();
      return;
    }
    
    // Create script tag
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('node_modules/lamejs/lame.min.js');
    script.onload = () => {
      console.log('lamejs library loaded');
      resolve();
    };
    script.onerror = (error) => {
      console.error('Failed to load lamejs library:', error);
      reject(error);
    };
    
    // Add to page
    (document.head || document.documentElement).appendChild(script);
  });
}

// Load debug helper script
function loadDebugHelper() {
  return new Promise((resolve, reject) => {
    try {
      // Create script tag
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('debug-helper.js');
      script.onload = () => {
        console.log('Debug helper loaded');
        
        // Activate debug helpers
        if (window.AudioDebugHelper) {
          // Wait for AudioRecorderHelper to be available before enhancing it
          const checkInterval = setInterval(() => {
            if (window.AudioRecorderHelper) {
              clearInterval(checkInterval);
              window.AudioDebugHelper.injectDebugHelper();
              window.AudioDebugHelper.injectMessageDebugger();
              window.AudioDebugHelper.checkPermissions();
            }
          }, 100);
        }
        
        resolve();
      };
      script.onerror = (error) => {
        console.error('Failed to load debug helper:', error);
        reject(error);
      };
      
      // Add to page
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      console.error('Error in loadDebugHelper:', error);
      reject(error);
    }
  });
}

// Load bridge script
function loadBridgeScript() {
  return new Promise((resolve, reject) => {
    try {
      // Create script tag
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/bridge.js');
      script.onload = () => {
        console.log('Bridge script loaded');
        resolve();
      };
      script.onerror = (error) => {
        console.error('Failed to load bridge script:', error);
        reject(error);
      };
      
      // Add to page
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      console.error('Error in loadBridgeScript:', error);
      reject(error);
    }
  });
}

// Bridge communication state
let nextRequestId = 1;
const pendingRequests = new Map();

// Send a message through the bridge
function sendBridgeMessage(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    
    // Store the promise callbacks
    pendingRequests.set(id, { resolve, reject });
    
    // Post the message to the bridge
    window.postMessage({
      source: 'audio-transcription-content-script',
      id,
      method,
      params
    }, '*');
    
    // Set a timeout to reject the promise
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`Timeout waiting for bridge response to ${method}`));
      }
    }, 10000);
  });
}

// Listen for bridge messages
window.addEventListener('message', (event) => {
  // Make sure message is from our bridge
  if (event.data && event.data.source === 'audio-transcription-bridge') {
    const { id, result, error } = event.data;
    
    // Get the pending request
    const request = pendingRequests.get(id);
    if (request) {
      pendingRequests.delete(id);
      
      if (error) {
        request.reject(new Error(error.message));
      } else {
        request.resolve(result);
      }
    }
  }
});

// Listen for messages from the injected script
window.addEventListener('message', (event) => {
  // Only accept messages from our injected script
  if (event.source !== window || !event.data || event.data.source !== 'injected-recorder') {
    return;
  }

  const message = event.data;
  console.log('[ContentScript] Received message VIA WINDOW.POSTMESSAGE:', message);

  switch (message.action) {
    case 'recorderReady':
      console.log('[ContentScript] Received recorderReady from injected script (via window)');
      // Set flag or resolve promise if needed elsewhere
      break;
    case 'recordingError':
      console.error('[ContentScript] Received recordingError from injected script (via window):', message.error);
      // Forward error to UI iframe if appropriate
      if (sidePanelIframe) {
          sidePanelIframe.contentWindow.postMessage({ action: 'recordingError', error: message.error }, '*');
      }
      break;
    case 'recordingMetadataAvailable':
      console.log(`[ContentScript] Received ${message.action} with data (via window)`);
      // --- Convert Blob to Data URL before sending --- 
      if (message.metadata && message.blob && message.blob instanceof Blob) {
          // --- Add blob size to metadata --- 
          const fileSize = message.blob.size;
          message.metadata.fileSize = fileSize; // Add fileSize property
          console.log(`[ContentScript] Added fileSize to metadata: ${fileSize}`);
          // --- End add blob size ---

          console.log("[ContentScript] Blob received, attempting conversion to Data URL...");
          const reader = new FileReader();
          reader.onload = (e) => {
              const dataUrl = e.target.result;
              console.log("[ContentScript] Blob converted to Data URL (length:", dataUrl?.length, "). Sending to service worker...");
              if (!dataUrl) { 
                console.error("[ContentScript] Data URL conversion failed - null or empty result");
                injectForceDownloadScript(); 
                return; 
              }

              // Enhanced metadata with more details
              const enhancedMetadata = {
                ...message.metadata,
                title: message.metadata?.title || `Recording ${new Date().toLocaleString()}`,
                timestamp: message.metadata?.timestamp || Date.now(),
                fileSize: message.metadata?.fileSize || message.blob.size || (dataUrl.length * 0.75),
                mimeType: message.metadata?.mimeType || message.blob.type || 'audio/mp3',
                source: message.metadata?.source || recordingType || 'unknown',
                duration: message.metadata?.duration || 0
              };

              console.log("[ContentScript] Enhanced metadata:", enhancedMetadata);

              // Send updated metadata (including fileSize) and Data URL to service worker
              chrome.runtime.sendMessage(
                {
                  action: 'saveRecordingData',
                  data: {
                    metadata: enhancedMetadata,
                    audioDataUrl: dataUrl
                  }
                },
                (response) => {
                  // Check for runtime error first
                  if (chrome.runtime.lastError) {
                    console.error('[ContentScript] Chrome runtime error saving recording:', chrome.runtime.lastError);
                    injectForceDownloadScript();
                    return;
                  }

                  // Then check response
                  if (!response?.success) {
                    console.error('[ContentScript] Error response from service worker:', response?.error || 'Unknown error');
                    // Trigger emergency download if saving failed
                    console.log('[ContentScript] Saving failed, triggering emergency download.');
                    injectForceDownloadScript(); 
                  } else {
                    console.log('[ContentScript] Recording data saved successfully! Recording ID:', response.id);
                  }
                }
              );
          };
          reader.onerror = (e) => { 
            console.error('[ContentScript] FileReader error converting blob to data URL:', e.target.error);
            injectForceDownloadScript(); 
          };
          reader.readAsDataURL(message.blob);
      } else {
        console.error('[ContentScript] Invalid or missing metadata/blob in recordingMetadataAvailable message (via window):', message);
        injectForceDownloadScript(); // Fallback if data is incomplete/invalid
      }
      break;
     case 'stopAcknowledged':
       // This message is handled by the listener inside controlRecorder
       // We don't need to do anything with it here, but log for sanity check
       console.log("[ContentScript] Received stopAcknowledged (via window), should be handled by controlRecorder listener.")
       break;
     case 'recordingStarted':
        // This message is handled by the listener inside controlRecorder
        console.log("[ContentScript] Received recordingStarted (via window), should be handled by controlRecorder listener.")
        break;
    // Add other cases if needed from injected script
    default:
        console.warn('[ContentScript] Unhandled WINDOW message action from injected script:', message.action);
        break;
  }
});

// Listen ONLY for messages from Popup / Background Script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ignore messages potentially from self/injected script if they somehow get here
  if (sender.id !== chrome.runtime.id || message.source === 'injected-recorder') { 
      console.warn("[ContentScript] Ignoring unexpected message in runtime listener:", message, sender);
      return false; // Indicate message not handled
  }
  
  console.log('[ContentScript] Received message VIA CHROME RUNTIME:', message);
  
  // Use the async function to handle these reliably
  handlePopupMessage(message, sender, sendResponse);
  
  // Return true because handlePopupMessage uses async operations and sendResponse
  return true; 
});

// Function to handle messages specifically from the popup/background
async function handlePopupMessage(message, sender, sendResponse) {
    console.log('[ContentScript] Handling popup/background message:', message.action);
    switch (message.action) {
        case 'ping':
            console.log('Pong!');
            sendResponse({ success: true, message: 'pong' });
            break;
        case 'toggleSidePanel':
            toggleSidePanelVisibility();
            sendResponse({ success: true });
            break;
        case 'startRecording':
            console.log('[ContentScript] Received startRecording from popup');
            try {
                // Use controlRecorder to start recording via injected script
                const result = await controlRecorder('startRecording', { source: message.source, details: message.meetingDetails });
                sendResponse(result); // Forward result (success or error)
            } catch (error) {
                console.error('[ContentScript] Error in startRecording handler:', error);
                sendResponse({ success: false, error: error.message });
            }
            break;
        case 'stopRecording':
            console.log('[ContentScript] Received stopRecording from popup');
            try {
                 // Use controlRecorder to stop recording via injected script
                const result = await controlRecorder('stopRecording');
                sendResponse(result); // Forward result
            } catch (error) {
                console.error('[ContentScript] Error in stopRecording handler:', error);
                 // If stopping fails immediately, try emergency download
                 injectForceDownloadScript(); 
                sendResponse({ success: false, error: error.message });
            }
            break;
        case 'pauseRecording': // Note: SimpleRecorder doesn't support this
             console.log('[ContentScript] Received pauseRecording from popup (Not Supported)');
            // try {
            //      const result = await controlRecorder('pauseRecording');
            //      sendResponse(result);
            // } catch (error) { /* ... error handling ... */ }
            sendResponse({ success: false, error: 'Pause not supported' });
             break;
         case 'resumeRecording': // Note: SimpleRecorder doesn't support this
             console.log('[ContentScript] Received resumeRecording from popup (Not Supported)');
             // try {
             //     const result = await controlRecorder('resumeRecording');
             //     sendResponse(result);
             // } catch (error) { /* ... error handling ... */ }
             sendResponse({ success: false, error: 'Resume not supported' });
             break;
        case 'forceDownload': // Handle request from popup for emergency download
            console.log('[ContentScript] Received forceDownload request from popup');
            injectForceDownloadScript();
            sendResponse({ success: true });
            break;
        // Add other cases as needed
        default:
            console.warn('[ContentScript] Unhandled popup/background message action:', message.action);
            sendResponse({ success: false, error: 'Unknown action' });
            break;
    }
    // Return value is handled by the outer listener returning true
}

// Initialize recorder
async function initializeRecorder() {
  try {
    // Load bridge script first
    await loadBridgeScript().catch(e => console.warn('Bridge script load failed, continuing:', e));
    
    // Load debug helper
    await loadDebugHelper().catch(e => console.warn('Debug helper load failed, continuing:', e));
    
    // Load lamejs library
    await loadLameJsLibrary();
    
    // Ensure the main injected recorder is ready via injection logic
    // injectRecorderScript() might be called later when needed by UI interactions
    // For now, we don't necessarily need to pre-inject it here unless essential

    // Check status through bridge (if applicable)
    // try {
    //   const status = await sendBridgeMessage('checkStatus');
    //   console.log('Recorder status:', status);
    // } catch (e) {
    //   console.warn('Failed to get recorder status:', e);
    // }
    
    console.log('Content script initialized (dependencies loaded, injected recorder will be loaded on demand)');
    return true;
  } catch (error) {
    console.error('Failed to initialize content script essentials:', error);
    return false;
  }
}

// Create and inject side panel
function createSidePanel() {
  // Check if panel already exists
  if (sidePanelContainer) {
    console.log("[ContentScript] Side panel already exists.");
    return; // Already exists, do nothing. Visibility is handled by toggleSidePanelVisibility
  }
  console.log("[ContentScript] Creating side panel...");

  try {
      // Create panel container
      sidePanelContainer = document.createElement('div');
      sidePanelContainer.id = 'audio-transcription-side-panel';
      sidePanelContainer.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 350px;
        height: 100vh;
        background-color: white;
        box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
        z-index: 999999 !important; /* Increased z-index */
        transition: transform 0.3s ease;
        transform: translateX(100%);
        display: flex;
        flex-direction: column;
        font-family: 'Roboto', sans-serif;
        border-left: 1px solid #ccc; /* Add border for visibility */
      `;
      console.log("[ContentScript] Panel container element created.");

      // Create iframe to load popup content
      const iframe = document.createElement('iframe');
      iframe.id = 'audio-transcription-iframe'; 
      const iframeSrc = chrome.runtime.getURL('popup/popup.html');
      iframe.src = iframeSrc;
      console.log(`[ContentScript] Setting iframe src to: ${iframeSrc}`);
      iframe.style.cssText = `
        border: none;
        width: 100%;
        height: 100%;
        overflow: hidden;
      `;
      
      // Check if iframe loading fails
      iframe.onerror = () => {
          console.error("[ContentScript] Iframe failed to load src:", iframeSrc);
      };
      iframe.onload = () => {
          console.log("[ContentScript] Iframe loaded successfully.");
      };

      // Add iframe to container
      sidePanelContainer.appendChild(iframe);
      sidePanelIframe = iframe; // Store reference
      console.log("[ContentScript] Iframe appended to container.");

      // Add container to page
      if (document.body) {
          document.body.appendChild(sidePanelContainer);
          console.log("[ContentScript] Side panel container appended to body.");
      } else {
          console.error("[ContentScript] document.body not found! Cannot append side panel.");
          sidePanelContainer = null; // Reset container if body wasn't found
          return;
      }

      // Set initial visibility state 
      if (sidePanelVisible) {
          console.log("[ContentScript] Setting initial transform to visible (translateX(0)).");
          sidePanelContainer.style.transform = 'translateX(0)';
      } else {
          console.log("[ContentScript] Setting initial transform to hidden (translateX(100%)).");
          sidePanelContainer.style.transform = 'translateX(100%)'; 
      }

      // --- Define the message handler function --- 
      function handleIframeMessages(event) {
          // Make sure message is from our specific iframe
          if (event.source !== sidePanelIframe?.contentWindow) {
              return; // Ignore messages from other sources
          }
          
          if (!event.data || !event.data.action) return;
          console.log("[ContentScript] Received message FROM iframe:", event.data);

          switch (event.data.action) {
            case 'hideSidePanel':
              // Hide side panel when requested from popup
              toggleSidePanelVisibility();
              break;
              
            case 'startRecording':
              // Inject the recorder script first if needed
              injectRecorderScript()
                .then(() => controlRecorder('startRecording'))
                .then(() => {
                  console.log('Recording started with injected recorder');
                })
                .catch(error => {
                  console.error('Error starting recording:', error);
                  // Send error back to iframe
                  sidePanelIframe?.contentWindow.postMessage({
                    action: 'recordingError',
                    error: error.message
                  }, '*');
                });
              break;
              
            case 'pauseRecording':
              // SimpleRecorder doesn't support pause, so we ignore this
              console.log('Pause not supported in simplified recorder');
              break;
              
            case 'resumeRecording':
              // SimpleRecorder doesn't support resume, so we ignore this
              console.log('Resume not supported in simplified recorder');
              break;
              
            case 'stopRecording':
              // Use the recorder script to stop recording
              injectRecorderScript()
                .then(() => controlRecorder('stopRecording'))
                .then((stopResult) => {
                  console.log('Recording stopped confirmation received by content script:', stopResult);
                  // Note: The blob/metadata is now handled by the main chrome.runtime.onMessage listener
                })
                .catch(error => {
                  console.error('Error stopping recording:', error);
                  // Force a download even if there's an error
                  injectForceDownloadScript();
                  // Send error back to iframe
                  sidePanelIframe?.contentWindow.postMessage({
                      action: 'recordingError',
                      error: `Stop error: ${error.message}`
                  }, '*');
                });
              break;
              
            case 'forceDownload':
              // Force a download directly
              injectForceDownloadScript();
              break;
            
            // Add other cases if needed
            default:
                 console.warn("[ContentScript] Unhandled IFRAME message action:", event.data.action);
                 break;
          }
      }
      // --- End function definition --- 

      // Add message listener using the defined function
      window.addEventListener('message', handleIframeMessages);
      console.log("[ContentScript] Added message listener for iframe.");

  } catch (error) {
      console.error("[ContentScript] Error during createSidePanel:", error);
      sidePanelContainer = null; // Ensure cleanup on error
      sidePanelIframe = null;
  }
}

// Toggle side panel visibility
function toggleSidePanelVisibility() { 
  console.log("[ContentScript] Toggling side panel visibility...");
  if (!sidePanelContainer) {
    console.log("[ContentScript] Side panel container not found, creating...");
    createSidePanel();
    // If createSidePanel failed, sidePanelContainer might still be null
    if (!sidePanelContainer) {
        console.error("[ContentScript] Failed to create side panel container. Aborting toggle.");
        return;
    }
  }

  sidePanelVisible = !sidePanelVisible;
  console.log(`[ContentScript] Side panel visible state set to: ${sidePanelVisible}`);

  if (sidePanelVisible) {
    console.log("[ContentScript] Sliding panel IN.");
    sidePanelContainer.style.transform = 'translateX(0)';
  } else {
    console.log("[ContentScript] Sliding panel OUT.");
    sidePanelContainer.style.transform = 'translateX(100%)';
  }
}

// Inject the force download script
function injectForceDownloadScript() {
  console.log('Injecting force download script');
  
  try {
    // Create script tag
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/force-download.js');
    
    // Add to page
    (document.head || document.documentElement).appendChild(script);
    
    // Remove after execution
    script.onload = () => {
      script.remove();
    };
    
    // Handle error
    script.onerror = (error) => {
      console.error('Failed to load force download script:', error);
      
      // Try direct download as last resort
      try {
        // Create a valid silent MP3 file with proper headers
        // This is a minimal but valid MP3 file that will play in any MP3 player
        const silentMp3 = new Uint8Array([
          0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0F, 0x54, 0x49, 0x54, 0x32, 
          0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x53, 0x69, 0x6C, 0x65, 0x6E, 0x63, 0x65, 0x00, 
          0xFF, 0xFB, 0x90, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
        ]);
        
        // Repeat the frame 50 times to make a longer file
        const repetitions = 50;
        const mp3Data = new Uint8Array(silentMp3.length * repetitions);
        for (let i = 0; i < repetitions; i++) {
          mp3Data.set(silentMp3, i * silentMp3.length);
        }
        
        const blob = new Blob([mp3Data], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'emergency-recording-' + Date.now() + '.mp3';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      } catch (downloadError) {
        console.error('Absolute final fallback download failed:', downloadError);
      }
    };
  } catch (error) {
    console.error('Error creating force download script:', error);
  }
}

// Request screen sharing and capture audio
async function startScreenCapture() {
  console.log('Starting screen capture');
  
  if (isRecording) {
    throw new Error('Already recording');
  }
  
  try {
    // Request screen sharing with audio
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });
    
    // Check if we have audio
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      // Stop video tracks if no audio is available
      stream.getVideoTracks().forEach(track => track.stop());
      throw new Error('No audio track available from screen sharing');
    }
    
    // Set up MediaRecorder with only the audio track
    const audioStream = new MediaStream(audioTracks);
    mediaRecorder = new MediaRecorder(audioStream);
    
    // Handle data available event
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    // Handle recording stopped
    mediaRecorder.onstop = () => {
      console.log('Media recorder stopped');
      
      // Create blob from recorded chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      
      // Send audio data to background script
      chrome.runtime.sendMessage({
        action: 'audioDataAvailable',
        audioBlob: audioBlob
      });
      
      // Reset state
      audioChunks = [];
      isRecording = false;
    };
    
    // Start recording
    mediaRecorder.start(1000); // Collect data in 1-second chunks
    isRecording = true;
    
    // Listen for end of screen sharing
    stream.getVideoTracks()[0].onended = () => {
      if (isRecording && mediaRecorder.state !== 'inactive') {
        stopScreenCapture();
      }
    };
    
    return { success: true };
    
  } catch (error) {
    console.error('Error starting screen capture:', error);
    isRecording = false;
    throw error;
  }
}

// Stop screen capture
async function stopScreenCapture() {
  console.log('Stopping screen capture');
  
  if (!isRecording || !mediaRecorder) {
    throw new Error('No active recording to stop');
  }
  
  try {
    // Stop MediaRecorder if it's active
    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error stopping screen capture:', error);
    throw error;
  } finally {
    // Reset state even if there's an error
    isRecording = false;
  }
}

// Helper function to check if we're in a meeting on common platforms
function detectMeetingPlatform() {
  const url = window.location.href;
  
  if (url.includes('meet.google.com')) {
    return 'Google Meet';
  } else if (url.includes('zoom.us')) {
    return 'Zoom';
  } else if (url.includes('teams.microsoft.com')) {
    return 'Microsoft Teams';
  } else if (url.includes('webex.com')) {
    return 'Cisco Webex';
  }
  
  return null;
}

// Use the injected recorder script instead of inline scripts
// Check if recorder script is already loaded and reuse it if possible
let recorderScriptLoaded = false;

function injectRecorderScript() {
  // If already loaded and initialized, just return a resolved promise
  if (recorderScriptLoaded) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    try {
      // Set up listener for messages from the injected script
      const messageListener = function(event) {
        // Handle ping response
        if (event.data && event.data.source === 'injected-recorder' && event.data.action === 'pong') {
          console.log('Recorder already available');
          recorderScriptLoaded = true;
          clearTimeout(pingTimeout);
          resolve();
          window.removeEventListener('message', messageListener);
          return;
        }
        
        // Handle ready notification
        if (event.data && event.data.source === 'injected-recorder') {
          if (event.data.action === 'recorderReady') {
            console.log('Injected recorder is ready');
            recorderScriptLoaded = true;
            resolve();
            window.removeEventListener('message', messageListener);
          } else if (event.data.action === 'recordingError') {
            console.error('Recording error from injected script:', event.data.error);
            // We don't reject here because we want to keep the listener active
          }
        }
      };
      
      window.addEventListener('message', messageListener);
      
      // First try to send a ping to see if recorder is already available
      window.postMessage({
        source: 'content-script-recorder',
        command: 'ping'
      }, '*');
      
      // Wait briefly for a response, then inject if needed
      const pingTimeout = setTimeout(() => {
        console.log('No response to ping, injecting recorder script');
        
        // Create script tag
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('content/injected-recorder.js');
        
        // Set a timeout in case the script doesn't load or notify
        const scriptTimeout = setTimeout(() => {
          window.removeEventListener('message', messageListener);
          reject(new Error('Timeout waiting for injected recorder to load'));
        }, 5000);
        
        // Handle successful load
        script.onload = () => {
          console.log('Injected recorder script loaded');
          // We don't resolve here because we wait for the recorderReady message
          clearTimeout(scriptTimeout);
        };
        
        // Handle load error
        script.onerror = (error) => {
          console.error('Failed to load injected recorder script:', error);
          window.removeEventListener('message', messageListener);
          clearTimeout(scriptTimeout);
          reject(error);
        };
        
        // Add to page
        (document.head || document.documentElement).appendChild(script);
      }, 500); // Wait 500ms for a response to ping
    } catch (error) {
      console.error('Error in injectRecorderScript:', error);
      reject(error);
    }
  });
}

// Control the recorder through messages
function controlRecorder(action, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      // Ensure the injected script is ready before sending commands
      injectRecorderScript().then(() => {
        // Create listener for responses from the recorder
        const messageListener = function(event) {
          if (event.data && event.data.source === 'injected-recorder') {
            console.log("[ContentScript] controlRecorder messageListener received:", event.data);
            
            // Specific confirmations based on action
            let expectedAction = null;
            if (action === 'startRecording') {
                expectedAction = 'recordingStarted';
            } else if (action === 'stopRecording') {
                expectedAction = 'stopAcknowledged'; // Wait for ack, not full data
            } // Add pause/resume later if needed

            if (expectedAction && event.data.action === expectedAction) {
                console.log(`[ContentScript] Recorder ${action} action confirmed by ${expectedAction}`);
                resolve({ success: true, details: event.data }); // Resolve with success
                window.removeEventListener('message', messageListener);
                clearTimeout(timeoutId);
            } else if (event.data.action === 'recordingError') {
                console.error('[ContentScript] controlRecorder received recordingError:', event.data.error);
                reject(new Error(event.data.error)); // Reject on error
                window.removeEventListener('message', messageListener);
                clearTimeout(timeoutId);
            }
          }
        };
        
        window.addEventListener('message', messageListener);
        
        // Set a timeout to handle case where we don't get a response
        const timeoutId = setTimeout(() => {
          window.removeEventListener('message', messageListener);
          reject(new Error(`Timeout waiting for ${action} confirmation (20s)`)); 
        }, 20000); // 20 seconds timeout
        
        // Add logging before sending the command
        console.log(`[ContentScript] Sending command '${action}' to injected script at ${new Date().toLocaleTimeString()}`);
        
        // Send the command to the injected script
        window.postMessage({
          source: 'content-script-recorder',
          command: action,
          options: options // Pass any options (like source type for start)
        }, '*');
        
        console.log(`Sent ${action} command to injected recorder`);
      }).catch(injectionError => {
           console.error("[ContentScript] Failed to inject recorder script before sending command:", injectionError);
           reject(injectionError); // Reject if injection fails
      });
    } catch (error) {
      console.error(`Error sending ${action} command:`, error);
      reject(error);
    }
  });
}

// Transcription handler to process audio with WebAssembly
const TranscriptionHandler = {
  // Track active transcriptions
  activeTranscriptions: new Map(),
  
  // Initialize the transcription system
  async initialize() {
    // Load required modules dynamically when needed
    this.whisperTranscriber = null;
    this.isInitialized = false;
    console.log('[ContentScript] TranscriptionHandler initialized');
  },
  
  // Process a transcription request
  async processTranscription(requestId, audioBlob, options) {
    console.log(`[ContentScript] Starting transcription process for ${requestId}`);
    
    // Initialize on first use
    if (!this.isInitialized) {
      console.log('[ContentScript] First-time initialization of whisper transcriber');
      try {
        // Dynamically import the transcriber module
        const scriptUrl = chrome.runtime.getURL('lib/whisper/whisper-transcriber.js');
        
        // Create a script element to load the module (can't use import() in content scripts)
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = scriptUrl;
          script.type = 'module';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
          
          // Also load the worker manager
          const managerScript = document.createElement('script');
          managerScript.src = chrome.runtime.getURL('lib/whisper/transcription-worker-manager.js');
          managerScript.type = 'module';
          document.head.appendChild(managerScript);
        });
        
        // Access the transcriber via bridge after loaded
        this.whisperTranscriber = await sendBridgeMessage('getWhisperTranscriber');
        await sendBridgeMessage('initializeWhisperTranscriber', { modelSize: options.modelSize || 'tiny' });
        
        this.isInitialized = true;
        console.log('[ContentScript] Whisper transcriber initialized successfully');
      } catch (error) {
        console.error('[ContentScript] Failed to initialize whisper transcriber:', error);
        this._sendStatusUpdate(requestId, 'failed', 0, 'Failed to initialize transcriber');
        throw error;
      }
    }
    
    // Track this transcription
    this.activeTranscriptions.set(requestId, { 
      status: 'processing',
      progress: 0,
      startTime: Date.now()
    });
    
    try {
      // Send status update
      this._sendStatusUpdate(requestId, 'processing', 0);
      
      // Perform the actual transcription
      console.log(`[ContentScript] Starting actual transcription for ${requestId}`);
      
      // Use bridge message to perform transcription
      const result = await sendBridgeMessage('transcribeAudio', { 
        requestId,
        audioBlob: await blobToBase64(audioBlob),
        options
      });
      
      // Send success response
      this._sendStatusUpdate(requestId, 'completed', 100);
      chrome.runtime.sendMessage({
        action: 'transcriptionComplete',
        requestId,
        result
      });
      
      // Clean up
      this.activeTranscriptions.delete(requestId);
      return result;
    } catch (error) {
      console.error('[ContentScript] Transcription error:', error);
      
      // Handle failures
      this._sendStatusUpdate(requestId, 'failed', 0, error.message);
      chrome.runtime.sendMessage({
        action: 'transcriptionFailed',
        requestId,
        error: error.message
      });
      
      // Clean up
      this.activeTranscriptions.delete(requestId);
      throw error;
    }
  },
  
  // Send status updates to the service worker
  _sendStatusUpdate(requestId, status, progress, error = null) {
    chrome.runtime.sendMessage({
      action: 'transcriptionStatus',
      requestId,
      status,
      progress,
      error
    });
  }
};

// Helper function to convert Blob to base64
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Initialize content script
function initialize() {
  console.log('[ContentScript] Initializing...');
  
  // Initialize the transcription handler
  TranscriptionHandler.initialize().catch(error => {
    console.warn('[ContentScript] Error initializing transcription handler:', error);
  });
  
  // Load libraries as needed
  loadLameJsLibrary()
    .then(() => loadDebugHelper())
    .then(() => loadBridgeScript())
    .then(() => {
      console.log('[ContentScript] All libraries loaded successfully');
      
      // Auto-initialize recorder if on supported platform
      const platform = detectMeetingPlatform();
      if (platform) {
        console.log(`[ContentScript] Detected ${platform}, initializing recorder early`);
        injectRecorderScript().catch(err => {
          console.warn('[ContentScript] Early recorder initialization failed, will retry later:', err);
        });
        
        // Notify the background script about the detected meeting
        chrome.runtime.sendMessage({
          action: 'meetingDetected',
          platform: platform,
          url: window.location.href,
          title: document.title
        });
      }
    })
    .catch(error => {
      console.error('[ContentScript] Error loading libraries:', error);
    });
    
  // Add listener for recording actions from the injected panel
  document.addEventListener('recording-action', function(event) {
    console.log('[ContentScript] Received recording-action event:', event.detail);
    // Process the action - this reuses the existing handlePopupMessage logic
    handlePopupMessage(event.detail, {id: chrome.runtime.id}, (result) => {
      console.log('[ContentScript] Recording action result:', result);
      // Send the result back to the panel
      document.dispatchEvent(new CustomEvent('recording-result', { 
        detail: result 
      }));
    });
  });
}

// Run initialization when the page loads
window.addEventListener('load', initialize);

// Listen for messages from test pages
window.addEventListener('message', (event) => {
  // Check if the message is from our test page
  if (event.source === window && event.data && event.data.source === 'transcription-test') {
    console.log('[ContentScript] Received message from test page:', event.data);
    
    const { id, method, params } = event.data;
    
    // Process the message
    if (method === 'transcribeAudio') {
      // Extract audio data
      let audioBlob;
      
      try {
        // If audioBlob is a string (base64/dataUrl), convert it to a Blob
        if (typeof params.audioBlob === 'string') {
          const parts = params.audioBlob.split(',');
          const mime = parts[0].match(/:(.*?);/)[1];
          const binaryString = atob(parts[1]);
          const array = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            array[i] = binaryString.charCodeAt(i);
          }
          audioBlob = new Blob([array], { type: mime });
        } else {
          audioBlob = params.audioBlob;
        }
        
        // Process the transcription
        TranscriptionHandler.processTranscription(
          params.requestId || id,
          audioBlob,
          params.options || {}
        )
        .then(result => {
          // Send the result back
          window.postMessage({
            source: 'audio-transcription-content-script',
            id,
            result
          }, '*');
        })
        .catch(error => {
          // Send error back
          window.postMessage({
            source: 'audio-transcription-content-script',
            id,
            error: { message: error.message, stack: error.stack }
          }, '*');
        });
      } catch (error) {
        // Send error for parsing issues
        window.postMessage({
          source: 'audio-transcription-content-script',
          id,
          error: { message: 'Failed to process audio data: ' + error.message, stack: error.stack }
        }, '*');
      }
    } else {
      // Unsupported method
      window.postMessage({
        source: 'audio-transcription-content-script',
        id,
        error: { message: `Unsupported method: ${method}` }
      }, '*');
    }
  }
});
