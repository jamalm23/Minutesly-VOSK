// background/offscreen-manager.js

// Constants
const OFFSCREEN_URL = chrome.runtime.getURL('offscreen/offscreen.html');
const MAX_CONNECT_ATTEMPTS = 5;

// State
let offscreenDocumentExists = false; // Track if we think it exists (internal state)
let offscreenCreationInProgress = false;
let offscreenCreationPromise = null;
let offscreenPort = null;
let portConnectAttempts = 0;
let readyState = {
    ready: false,
    timestamp: null,
    attempts: 0
};
let pendingInitMessage = null; // To store init details if SW starts before offscreen is ready
let offscreenReadyPromise = null;
let resolveOffscreenReady = null;
let portListenerSetUp = false;

// --- Offscreen Document Lifecycle ---

/**
 * Checks if an offscreen document currently exists.
 * Uses chrome.offscreen.hasDocument if available, otherwise falls back.
 * @returns {Promise<boolean>} True if a document exists, false otherwise.
 */
export async function hasOffscreenDocument() {
    try {
        if (chrome.offscreen && chrome.offscreen.hasDocument) {
            return await chrome.offscreen.hasDocument();
        }
        const documents = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
        });
        offscreenDocumentExists = documents.length > 0;
        return offscreenDocumentExists;
    } catch (error) {
        console.error('[OffscreenManager] Error checking for offscreen document:', error);
        return false; // Assume no document on error
    }
}

/**
 * Ensures an offscreen document is created and ready.
 * Handles concurrent calls and retries on failure.
 * @param {number} retryCount - Maximum number of retry attempts.
 * @param {number} delayMs - Base delay between retries.
 * @returns {Promise<boolean>} True if the document exists or was created, false on failure.
 */
export async function ensureOffscreenDocument(retryCount = 3, delayMs = 500) {
    if (offscreenCreationInProgress && offscreenCreationPromise) {
        console.log('[OffscreenManager] Document creation already in progress, reusing promise');
        return offscreenCreationPromise;
    }

    try {
        // First check if it exists already
        const exists = await hasOffscreenDocument();
        
        if (exists) {
            console.log('[OffscreenManager] Offscreen document already exists');
            offscreenDocumentExists = true;
            
            // If it exists, ensure we try to connect a port if we don't have one
            if (!offscreenPort) {
                console.log('[OffscreenManager] Document exists but no port, establishing connection...');
                try {
                    await establishPortConnection();
                } catch (connErr) {
                    console.warn('[OffscreenManager] Failed to establish port with existing document:', connErr);
                    // If we can't connect to an existing document, try closing and recreating it
                    console.log('[OffscreenManager] Attempting to close and recreate document...');
                    try {
                        await closeOffscreenDocument();
                        // Continue to creation logic below instead of returning true
                    } catch (closeErr) {
                        console.error('[OffscreenManager] Error closing document:', closeErr);
                        // Continue to creation even if close fails
                    }
                }
            } else {
                return true; // If document exists and we have port, we're good
            }
        }

        // If we get here either document doesn't exist or we failed to connect to existing one
        console.log('[OffscreenManager] Creating new offscreen document...');
        offscreenCreationInProgress = true;
        offscreenCreationPromise = (async () => {
            for (let attempt = 0; attempt <= retryCount; attempt++) {
                try {
                    if (attempt > 0) {
                        console.log(`[OffscreenManager] Retry attempt ${attempt} for creating offscreen document`);
                        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
                    }

                    // Ensure we're not trying to create a document that already exists
                    const recheck = await hasOffscreenDocument();
                    if (recheck) {
                        console.log('[OffscreenManager] Document exists on recheck before creation');
                        offscreenDocumentExists = true;
                        // Try to connect even if it exists
                        if (!offscreenPort) {
                            try {
                                await establishPortConnection();
                            } catch (connErr) {
                                console.warn('[OffscreenManager] Port connection failed after recheck:', connErr);
                                // But continue even if connection fails
                            }
                        }
                        return true;
                    }

                    // Create the document
                    await chrome.offscreen.createDocument({
                        url: OFFSCREEN_URL,
                        reasons: ['AUDIO_PLAYBACK'], // Required for transcription
                        justification: 'Audio transcription processing'
                    });
                    
                    // Allow a short delay for creation to complete
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    console.log('[OffscreenManager] Offscreen document created successfully');
                    offscreenDocumentExists = true;
                    
                    // Reset state related to readiness
                    resetOffscreenState();
                    
                    // Try to establish port connection after document is created
                    console.log('[OffscreenManager] Document created, establishing port connection...');
                    try {
                        await establishPortConnection();
                        console.log('[OffscreenManager] Port connection established successfully');
                    } catch (connErr) {
                        console.warn('[OffscreenManager] Error establishing port after creation:', connErr);
                        // Continue even if port connection fails initially
                    }
                    
                    return true;

                } catch (error) {
                    // Handle the case where a document already exists (common error)
                    if (error && error.message && error.message.includes('Only a single offscreen document')) {
                        console.warn('[OffscreenManager] Offscreen document already exists – treating as success');
                        offscreenDocumentExists = true;
                        
                        // Try to connect to the existing document
                        if (!offscreenPort) {
                            try {
                                await establishPortConnection();
                            } catch (connErr) {
                                console.warn('[OffscreenManager] Unable to establish port after existing document detected:', connErr);
                                // Continue even if connection fails
                            }
                        }
                        return true;
                    }
                    
                    console.error(`[OffscreenManager] Error creating offscreen document (attempt ${attempt + 1}/${retryCount + 1}):`, error);
                    
                    // Only throw if we're on the last attempt
                    if (attempt === retryCount) throw error;
                }
            }
            
            throw new Error('Failed to create offscreen document after multiple attempts');
        })();
        
        const result = await offscreenCreationPromise;
        return result;
        
    } catch (error) {
        console.error('[OffscreenManager] Fatal error in ensureOffscreenDocument:', error);
        return false;
    } finally {
        offscreenCreationInProgress = false;
        offscreenCreationPromise = null;
    }
}

/**
 * Closes the offscreen document if it exists.
 * Disconnects the port first.
 * @returns {Promise<boolean>} True if closed or already closed, false on error.
 */
export async function closeOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        try {
            if (offscreenPort) {
                try {
                    offscreenPort.disconnect();
                } catch (e) {
                    /* ignore */
                }
                offscreenPort = null;
            }
            await chrome.offscreen.closeDocument();
            console.log('[OffscreenManager] Offscreen document closed');
            offscreenDocumentExists = false;
            resetOffscreenState(); // Reset ready state
            return true;
        } catch (error) {
            console.error('[OffscreenManager] Error closing offscreen document:', error);
            return false;
        }
    }
    console.log('[OffscreenManager] Close requested, but no document existed.');
    return true; // Already closed
}


// --- Port Communication ---

/**
 * Establishes a persistent port connection to the offscreen document.
 * Sets up a listener for the offscreen document to connect and resolves when it does.
 * @returns {Promise<boolean>} True once the connection is established, false otherwise.
 */
export async function establishPortConnection() {
  if (offscreenPort) {
    console.log('[OffscreenManager] Port already established');
    return true;
  }

  // Track attempts for debugging
  portConnectAttempts++;
  console.log(`[OffscreenManager] Setting up listener for offscreen document port connection... (attempt ${portConnectAttempts})`);

  return new Promise((resolve) => {
    // REMOVED: Timeout logic. Waiting is handled by whenOffscreenReady.

    function onConnectHandler(port) {
      // Log every port connection attempt regardless of name
      console.warn('[SW] 🔌 onConnect fired, port.name=', port.name);

      if (port.name === 'offscreen-port') {
        // REMOVED: clearTimeout(timeout);
        console.log('[OffscreenManager] Offscreen document connected via port');
        offscreenPort = port;

        // Set up the message listener immediately
        offscreenPort.onMessage.addListener(handleOffscreenMessage);
        
        // Set up disconnect listener
        offscreenPort.onDisconnect.addListener(() => {
          console.warn('[OffscreenManager] Offscreen port disconnected');
          offscreenPort = null;
          resetOffscreenState();
        });
        
        // Remove this specific connect listener
        chrome.runtime.onConnect.removeListener(onConnectHandler);
        
        // Immediately send a ping to verify the connection is working
        try {
          offscreenPort.postMessage({ type: 'PING', timestamp: Date.now() });
          console.log('[OffscreenManager] Sent initial PING after connection');
        } catch (e) {
          console.error('[OffscreenManager] Error sending initial ping:', e);
        }
        
        resolve(true);
      } else {
        console.log(`[OffscreenManager] Received port connection with unexpected name: ${port.name}`);
      }
    }
    
    // Add the global listener
    chrome.runtime.onConnect.addListener(onConnectHandler);
    
    // Additional debug: check if onConnect listener was added
    setTimeout(() => {
      const listeners = chrome.runtime.onConnect.hasListeners();
      console.log(`[OffscreenManager] onConnect has listeners: ${listeners}`);
    }, 500);
  });
}

/**
 * Handles messages received from the offscreen document via the port.
 * Updates ready state and forwards messages if needed.
 * @param {object} message - The message received from the offscreen document.
 */
function handleOffscreenMessage(message) {
    console.log('[OffscreenManager] Received message from offscreen via port:', message);

    // Handle heartbeat messages to keep connection alive
    if (message && message.type === 'HEARTBEAT') {
        console.log('[OffscreenManager] Heartbeat received, sending ack');
        try {
            // Send acknowledgment to keep the connection alive
            if (offscreenPort) {
                offscreenPort.postMessage({ type: 'HEARTBEAT_ACK', timestamp: Date.now() });
            }
        } catch (e) {
            console.warn('[OffscreenManager] Error sending heartbeat ack:', e);
        }
        return; // Don't process further
    }

    if (message && message.type === 'PORT_CONNECTED') {
        console.log('[OffscreenManager] Port connection confirmed by offscreen document.');
        updateReadyState(true, { method: 'port_ack' });
        
        // Send a message asking for ready state
        if (offscreenPort) {
            try {
                console.log('[OffscreenManager] Requesting ready state from offscreen document');
                offscreenPort.postMessage({ type: 'GET_READY_STATE' });
            } catch (e) {
                console.warn('[OffscreenManager] Error requesting ready state:', e);
            }
        }
    }

    if (message && message.type === 'OFFSCREEN_READY') {
        console.log('[OffscreenManager] Received OFFSCREEN_READY via port');
        updateReadyState(true, { method: 'ready_message', via: 'port' });
        portConnectAttempts = 0; // Reset attempts on successful ready signal

        // Handle pending init message if any
        if (pendingInitMessage && offscreenPort) {
            console.log('[OffscreenManager] Sending pending INIT_WHISPER via active port');
            try {
                offscreenPort.postMessage(pendingInitMessage);
                pendingInitMessage = null;
            } catch (e) {
                console.error('[OffscreenManager] Error sending pending init message:', e);
                // Consider how to handle this - retry? Close document?
            }
        }
    }

    // --- Forward specific messages back to the main service worker/other parts --- 
    // Example: Forward transcription results/errors
    if (message && (message.type === 'TRANSCRIPTION_RESULT' || message.type === 'TRANSCRIPTION_ERROR' || 
                   message.type === 'STATUS_UPDATE')) {
        // Use chrome.runtime.sendMessage to broadcast within the extension
        chrome.runtime.sendMessage(message).catch(error => {
             // Handle potential errors if no listeners are available
             console.warn(`[OffscreenManager] Error forwarding message type ${message.type}:`, error.message);
         });
    }

    // Handle other message types as needed...
}

/**
 * Sends a message to the offscreen document via the established port.
 * Ensures the port exists before sending.
 * @param {object} message - The message object to send.
 * @returns {Promise<boolean>} True if message was sent, false otherwise.
 */
export async function postMessageToOffscreen(message) {
    if (!offscreenPort) {
        console.warn('[OffscreenManager] Attempted to send message, but no port is connected.');
        // Optional: try to establish connection first
        // const connected = await establishPortConnection();
        // if (!connected) return false;
        return false;
    }
    try {
        console.log('[OffscreenManager] Posting message to offscreen:', message);
        offscreenPort.postMessage(message);
        return true;
    } catch (error) {
        console.error('[OffscreenManager] Error posting message to offscreen:', error);
        // Handle specific errors, e.g., port disconnected
        if (error.message.includes('disconnected port')) {
            offscreenPort = null;
            resetOffscreenState();
            // Optionally try to reconnect and resend
        }
        return false;
    }
}

// --- Ready State Management ---

/**
 * Gets the current ready state of the offscreen document.
 * @returns {Promise<object>} The ready state object.
 */
export async function getReadyState() {
    // Maybe add a check here to see if the document *actually* exists
    // if (!await hasOffscreenDocument()) { updateReadyState(false); }
    return { ...readyState }; // Return a copy
}

/**
 * Updates the internal ready state.
 * @param {boolean} isReady - Whether the offscreen document is considered ready.
 * @param {object} details - Additional details about the state change.
 * @returns {Promise<object>} The updated ready state object.
 */
async function updateReadyState(isReady, details = {}) {
    const changed = readyState.ready !== isReady;
    readyState = {
        ready: isReady,
        timestamp: Date.now(),
        attempts: isReady ? readyState.attempts : (readyState.attempts || 0),
        ...details
    };
    if (changed) {
         console.log('[OffscreenManager] Offscreen ready state updated:', readyState);
         // If we just became ready, resolve the promise
        if (isReady && resolveOffscreenReady) {
            resolveOffscreenReady(true);
            // Reset promise state for next time
            offscreenReadyPromise = null;
            resolveOffscreenReady = null;
        }
    }
    return { ...readyState };
}

/**
 * Resets the offscreen document state, including readiness and port connection.
 */
export function resetOffscreenState() {
    console.log('[OffscreenManager] Resetting offscreen state.');
    
    // Close any existing port connection
    if (offscreenPort) {
        try {
            offscreenPort.disconnect();
        } catch (e) { /* ignore */ }
        offscreenPort = null;
    }
    
    // Reset connection attempts
    portConnectAttempts = 0;
    
    // Clear any pending messages
    pendingInitMessage = null;

    // Update ready state to false
    updateReadyState(false, { reason: 'reset' });

    // Reset the readiness promise - create a new one
    if (resolveOffscreenReady) {
        // Don't resolve, just create a new promise
    }
    
    offscreenReadyPromise = new Promise((resolve) => {
        resolveOffscreenReady = resolve;
    });
    
    console.log('[OffscreenManager] Offscreen state has been reset');
    return true;
}

/**
 * Returns a promise that resolves when the offscreen document signals it's ready.
 * @param {number} timeoutMs - Optional timeout in milliseconds.
 * @returns {Promise<boolean>} True if ready within timeout, false otherwise.
 */
export async function whenOffscreenReady(timeoutMs = 30000) {
    if (readyState.ready) {
        return true;
    }
    if (!offscreenReadyPromise) {
        resetOffscreenState(); // Ensure promise is initialized
    }

    console.log('[OffscreenManager] Waiting for offscreen ready signal...');

    // Race between the ready promise and a timeout
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(false), timeoutMs));

    const result = await Promise.race([offscreenReadyPromise, timeoutPromise]);

    if (result) {
        console.log('[OffscreenManager] Offscreen is ready.');
    } else {
        console.warn(`[OffscreenManager] Timeout waiting for offscreen ready signal (${timeoutMs}ms).`);
        // Optionally attempt to re-establish connection or close/recreate document here
    }
    return result;
}

/**
 * Stores a message to be sent once the offscreen document is ready.
 * Currently only supports one pending message (overwrites previous).
 * @param {object} message - The message to queue.
 */
export function setPendingInitMessage(message) {
    console.log('[OffscreenManager] Storing pending init message:', message);
    pendingInitMessage = message;
}

/**
 * Checks if there is an active port connection to the offscreen document.
 * @returns {boolean} True if there is an active port, false otherwise.
 */
export function hasActivePort() {
    return !!offscreenPort;
}

// --- Runtime Message Handling ---

/**
 * Handles runtime messages that may come from the offscreen document.
 * @param {object} message - The message received.
 * @param {object} sender - Information about the sender of the message.
 */
function handleRuntimeMessage(message, sender) {
    console.log('[OffscreenManager] Received runtime message from potential offscreen:', message);
    
    if (sender.id !== chrome.runtime.id) {
        return; // Only handle messages from our extension
    }

    // Check if this is an OFFSCREEN_READY message
    if (message && message.type === 'OFFSCREEN_READY') {
        console.log('[OffscreenManager] Received OFFSCREEN_READY via runtime messaging');
        // Update ready state even if we got this via runtime message instead of port
        updateReadyState(true, { method: 'ready_message', via: 'runtime' });
        return;
    }
    
    // Handle other debug messages
    if (message && message.type === 'OFFSCREEN_DEBUG') {
        console.log('[OffscreenManager] Received debug message from offscreen:', message);
        // Could update internal state based on debug messages
        return;
    }
}

// Set up listener for runtime messages from the offscreen document
chrome.runtime.onMessage.addListener(handleRuntimeMessage);

/**
 * Initializes the offscreen manager.
 * Sets up listeners and state.
 */
export function initOffscreenManager() {
    console.log('[OffscreenManager] Initializing offscreen manager');
    
    // Reset to a known state
    resetOffscreenState();
    
    // Make sure we have the runtime message listener
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    
    console.log('[OffscreenManager] Offscreen manager initialized');
}

// Initialize the manager when this module is loaded
initOffscreenManager();

// --- Initialization ---

// Attempt to establish connection on startup if a document might exist
// (e.g., after a service worker crash and restart)
hasOffscreenDocument().then(exists => {
    if (exists) {
        console.log('[OffscreenManager] Found existing offscreen document on startup, attempting port connection.');
        establishPortConnection().catch(err => {
            console.warn('[OffscreenManager] Failed initial port connection attempt:', err);
            // Consider closing and recreating if connection fails repeatedly
            // closeOffscreenDocument().then(() => ensureOffscreenDocument());
        });
    }
});

// Listen for runtime messages that might indicate readiness (fallback if port fails)
// This is less reliable than the port but can be a backup.
chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.url?.includes(OFFSCREEN_URL)) {
        console.log('[OffscreenManager] Received runtime message from potential offscreen:', message);
        if (message && message.type === 'OFFSCREEN_READY') {
            console.log('[OffscreenManager] Received OFFSCREEN_READY via runtime message (fallback)');
            updateReadyState(true, { method: 'ready_message', via: 'runtime' });
            // Attempt port connection if not already established
            if (!offscreenPort) {
                 establishPortConnection();
            }
        }
    }
    // Return false to allow other listeners to process the message
    return false;
});

/**
 * Sends a message to the offscreen document.
 * Tries port first, falls back to runtime messaging.
 * @param {object} message - The message to send.
 * @returns {Promise<boolean>} True if sent via either method, false if both fail.
 */
export async function sendMessageToOffscreen(message) {
  // First try port if available
  if (offscreenPort) {
    try {
      console.log('[OffscreenManager] Posting message to offscreen via port:', message.type || 'unknown type');
      offscreenPort.postMessage(message);
      return true;
    } catch (error) {
      console.error('[OffscreenManager] Error posting message to offscreen via port:', error);
      // Port is likely disconnected, clear it
      if (error.message.includes('disconnected port')) {
        offscreenPort = null;
      }
      // Continue to runtime messaging fallback
    }
  }
  
  // Fall back to runtime messaging
  try {
    console.log('[OffscreenManager] Falling back to runtime.sendMessage for:', message.type || 'unknown type');
    await chrome.runtime.sendMessage(message);
    return true;
  } catch (error) {
    console.error('[OffscreenManager] Error sending message via both methods:', error);
    return false;
  }
}
