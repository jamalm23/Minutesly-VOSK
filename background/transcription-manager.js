// background/transcription-manager.js

import * as offscreenManager from './offscreen-manager.js';

// Track ongoing transcription requests
const transcriptionRequestMap = new Map();

// DEBUG flag for controlling logging verbosity
const DEBUG = true;

// Logger functions that respect DEBUG flag
const logger = {
  log: (...args) => DEBUG && console.log(...args),
  warn: (...args) => console.warn(...args), // Always show warnings
  error: (...args) => console.error(...args) // Always show errors
};

/**
 * Initiates the transcription of audio data.
 * Ensures the offscreen document is ready and sends the audio data for processing.
 * @param {string} audioDataUrl - The audio data URL to transcribe.
 * @param {string} requestId - A unique ID for this transcription request.
 * @param {Object} options - Optional configuration for transcription.
 * @returns {Promise<void>} A promise that resolves when the transcription request is sent.
 */
export async function transcribeAudio(audioDataUrl, requestId, options = {}) {
  logger.log(`[TranscriptionManager] Received transcription request: ${requestId}`);
  
  // Set initial status in the request map
  transcriptionRequestMap.set(requestId, { 
    status: 'queued', 
    startTime: Date.now(),
    audioSize: audioDataUrl ? audioDataUrl.length : 'unknown'
  });

  try {
    // 1. Make sure we have valid audio data
    if (!audioDataUrl) {
      logger.error(`[TranscriptionManager] Invalid audioDataUrl for request: ${requestId}`);
      
      transcriptionRequestMap.set(requestId, { 
        status: 'error', 
        error: 'No audio data provided', 
        endTime: Date.now() 
      });
      
      // Notify of error
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPTION_ERROR',
        payload: {
          requestId,
          error: 'No audio data provided'
        },
        fromManager: true
      }).catch(err => logger.warn('Error sending error notification:', err));
      
      return;
    }
    
    // Check request ID
    if (!requestId) {
      logger.error('[TranscriptionManager] Missing request ID');
      throw new Error('Missing request ID');
    }

    // 2. Notify that we're starting
    transcriptionRequestMap.set(requestId, { 
      status: 'starting', 
      startTime: Date.now(),
      audioSize: audioDataUrl.length
    });
    
    // Broadcast start notification
    chrome.runtime.sendMessage({
      type: 'TRANSCRIPTION_STARTED',
      payload: {
        requestId
      },
      fromManager: true
    }).catch(err => logger.warn('Error sending start notification:', err));

    // 3. Make sure offscreen document exists
    logger.log('[TranscriptionManager] Ensuring offscreen document is ready...');
    
    // First just check if it's already ready
    let readyState = await offscreenManager.getReadyState();
    let isReady = readyState.ready;
    
    if (!isReady) {
      logger.log('[TranscriptionManager] Offscreen document not ready, creating/recreating...');
      
      // First close any existing document
      try {
        await offscreenManager.closeOffscreenDocument();
      } catch (closeErr) {
        logger.warn('[TranscriptionManager] Error closing document:', closeErr);
        // Continue anyway
      }
      
      // Create a fresh document
      const created = await offscreenManager.ensureOffscreenDocument();
      
      if (!created) {
        throw new Error('Failed to create offscreen document');
      }
      
      // Wait for it to be ready for up to 5 seconds
      isReady = await offscreenManager.whenOffscreenReady(5000);
      
      if (!isReady) {
        logger.warn('[TranscriptionManager] Offscreen document not signaling ready, proceeding anyway');
      }
    }
    
    // 4. Update status to processing
    transcriptionRequestMap.set(requestId, { 
      status: 'processing', 
      startTime: Date.now(),
      audioSize: audioDataUrl.length
    });

    // 5. Prepare the transcription message
    const message = {
      type: 'TRANSCRIBE_AUDIO',
      payload: {
        audioDataUrl,
        requestId,
        options: {
          ...options,
          timestamp: Date.now()
        }
      }
    };
    
    // Also send a START_TRANSCRIPTION message as many implementations expect this
    logger.log(`[TranscriptionManager] Sending START_TRANSCRIPTION for ${requestId}`);
    
    try {
      const startMessage = {
        type: 'START_TRANSCRIPTION',
        payload: {
          requestId,
          audioDataUrl
        }
      };
      
      // Try to send via port first
      if (offscreenManager.hasActivePort()) {
        const sent = await offscreenManager.postMessageToOffscreen(startMessage);
        if (!sent) {
          // Fall back to runtime messaging
          logger.log('[TranscriptionManager] Port send failed for START_TRANSCRIPTION, using runtime');
          chrome.runtime.sendMessage(startMessage).catch(err => {
            logger.warn('[TranscriptionManager] Failed to send START_TRANSCRIPTION via runtime:', err);
          });
        }
      } else {
        // No port, use runtime messaging
        logger.log('[TranscriptionManager] No port for START_TRANSCRIPTION, using runtime');
        chrome.runtime.sendMessage(startMessage).catch(err => {
          logger.warn('[TranscriptionManager] Failed to send START_TRANSCRIPTION via runtime:', err);
        });
      }
    } catch (startErr) {
      logger.warn('[TranscriptionManager] Error sending START_TRANSCRIPTION:', startErr);
      // Continue anyway
    }

    // 6. Now send the actual transcription request
    // Try to use port communication first
    logger.log(`[TranscriptionManager] Sending transcription request: ${requestId}`);
    
    let sent = false;
    
    if (offscreenManager.hasActivePort()) {
      logger.log(`[TranscriptionManager] Sending via port: ${requestId}`);
      sent = await offscreenManager.postMessageToOffscreen(message);
    }
    
    // If port failed or doesn't exist, use runtime messaging
    if (!sent) {
      logger.log(`[TranscriptionManager] Using runtime messaging: ${requestId}`);
      await chrome.runtime.sendMessage({
        ...message,
        fromManager: true
      });
      sent = true;
    }
    
    logger.log(`[TranscriptionManager] Transcription request sent successfully: ${requestId}`);
    
  } catch (error) {
    logger.error(`[TranscriptionManager] Error initiating transcription: ${error.message}`);
    logger.error(error.stack || 'No stack trace available');
    
    // Update request status
    transcriptionRequestMap.set(requestId, { 
      status: 'error', 
      error: error.message, 
      errorStack: error.stack,
      endTime: Date.now() 
    });
    
    // Notify of failure
    try {
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPTION_ERROR',
        payload: {
          requestId,
          error: `Failed to initiate transcription: ${error.message}`
        },
        fromManager: true
      });
    } catch (notifyErr) {
      logger.error('[TranscriptionManager] Error sending failure notification:', notifyErr);
    }
    
    // Provide a mock transcription as a fallback
    provideMockTranscription(requestId, `[MOCK] Transcription error: ${error.message}. This is a fallback result.`);
  }
}

/**
 * Handles the result of a transcription request.
 * Updates the request status and notifies clients.
 * @param {Object} message - The message containing the transcription result.
 * @returns {Promise<void>} A promise that resolves when the result is processed.
 */
export async function handleTranscriptionResult(message) {
  const { requestId, result } = message.payload;
  logger.log(`[TranscriptionManager] Received transcription result for request: ${requestId}`);
  transcriptionRequestMap.set(requestId, { status: 'completed', result: result, endTime: Date.now() });

  // Forward the result to any clients (popup/sidepanel)
  chrome.runtime.sendMessage({
    ...message,
    fromManager: true // Tag the message to prevent loops
  }).catch(err => 
    logger.warn(`[TranscriptionManager] Could not forward transcription result: ${err.message}`)
  );
}

/**
 * Handles errors that occur during transcription.
 * Updates the request status and notifies clients.
 * @param {Object} message - The message containing the error details.
 * @returns {Promise<void>} A promise that resolves when the error is processed.
 */
export async function handleTranscriptionError(message) {
  const { requestId, error } = message.payload;
  logger.error(`[TranscriptionManager] Received transcription error for request: ${requestId}:`, error);
  transcriptionRequestMap.set(requestId, { status: 'error', error: error, endTime: Date.now() });

  // Forward the error to any clients (popup/sidepanel)
  chrome.runtime.sendMessage({
    ...message,
    fromManager: true // Tag the message to prevent loops
  }).catch(err => 
    logger.warn(`[TranscriptionManager] Could not forward transcription error: ${err.message}`)
  );
}

/**
 * Initializes the transcription system.
 * Ensures the offscreen document is ready and initialized.
 * @param {string} modelSize - The size of the transcription model to use.
 * @returns {Promise<boolean>} A promise that resolves to true if initialization was successful.
 */
export async function initializeTranscriptionSystem(modelSize = 'base') {
  try {
    logger.log(`[TranscriptionManager] Initializing transcription system with model size: ${modelSize}`);
    
    // 1. Ensure offscreen document exists
    logger.log('[TranscriptionManager] Ensuring offscreen document exists...');
    const created = await offscreenManager.ensureOffscreenDocument();
    if (!created) {
      throw new Error('Failed to ensure offscreen document existence.');
    }
    logger.log('[TranscriptionManager] Offscreen document ensured.');

    // 2. Prepare and SEND the initialization message FIRST
    // This tells the offscreen document to start initializing Vosk.
    const initMessage = {
      type: 'INIT_TRANSCRIBER',
      payload: {
        modelSize: modelSize
      }
    };
    logger.log('[TranscriptionManager] Sending INIT_TRANSCRIBER message to offscreen...');
    const initSent = await offscreenManager.sendMessageToOffscreen(initMessage);
    if (!initSent) {
      // If we can't even send the init message via port or runtime, something is wrong.
      throw new Error('Failed to send INIT_TRANSCRIBER message to offscreen document.');
    }
    logger.log('[TranscriptionManager] INIT_TRANSCRIBER message sent successfully.');

    // 3. NOW, wait for the offscreen document to signal it's ready
    // It should become ready after processing the INIT_TRANSCRIBER message.
    logger.log('[TranscriptionManager] Waiting for offscreen document ready signal...');
    const isReady = await offscreenManager.whenOffscreenReady(); // Use existing function
    if (!isReady) {
      logger.error('[TranscriptionManager] Offscreen document did not become ready after init message.');
      // Optionally try to close and recreate, or just fail
      await offscreenManager.closeOffscreenDocument(); 
      throw new Error('Offscreen document failed to signal readiness after init message.');
    }
    logger.log('[TranscriptionManager] Offscreen document is ready.');

    // 4. Try to establish port connection (now that we know it's ready)
    // This is beneficial for performance but might fail; runtime messaging is the fallback.
    logger.log('[TranscriptionManager] Attempting to establish port connection post-readiness...');
    let portConnected = false;
    try {
      // Use a shorter timeout here as the document should be ready quickly
      portConnected = await offscreenManager.establishPortConnection(); 
      if (portConnected) {
        logger.log('[TranscriptionManager] Port connection established successfully.');
      } else {
        logger.warn('[TranscriptionManager] establishPortConnection returned false even after ready signal.');
      }
    } catch (err) {
      logger.warn('[TranscriptionManager] Error establishing port connection post-readiness:', err.message);
      // Continue without port, rely on runtime messaging
    }

    // Initialization sequence completed successfully (init message sent, readiness confirmed)
    logger.log('[TranscriptionManager] Transcription system initialization sequence complete.');
    return true;
    
  } catch (error) {
    logger.error('[TranscriptionManager] Error initializing transcription system:', error);
    // Attempt cleanup
    try {
      await offscreenManager.closeOffscreenDocument();
    } catch (cleanupError) {
      logger.error('[TranscriptionManager] Error during cleanup after initialization failure:', cleanupError);
    }
    return false;
  }
}

/**
 * Fallback initialization method using chrome.runtime.sendMessage instead of port
 * @param {string} modelSize - The size of the model to use 
 * @returns {Promise<boolean>} Whether initialization succeeded
 */
async function initializeViaRuntimeMessaging(modelSize) {
  return new Promise((resolve) => {
    logger.log('[TranscriptionManager] Using runtime messaging for initialization');
    
    // Set up a one-time response listener
    const responseListener = (response) => {
      if (response && response.type === 'OFFSCREEN_READY') {
        logger.log('[TranscriptionManager] Received OFFSCREEN_READY via runtime messaging');
        chrome.runtime.onMessage.removeListener(responseListener);
        resolve(true);
      }
    };
    
    // Listen for the response
    chrome.runtime.onMessage.addListener(responseListener);
    
    // Send the initialization message with consistent type
    chrome.runtime.sendMessage({
      type: 'INIT_TRANSCRIBER', // Use consistent message type
      modelSize: modelSize,
      fromManager: true // Tag the message to prevent loops
    }).then(response => {
      logger.log('[TranscriptionManager] Initialization message acknowledgment:', response);
      
      // Set a timeout to remove the listener if no response comes back
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(responseListener);
        logger.log('[TranscriptionManager] Fallback initialization timed out, but continuing anyway');
        resolve(true); // Resolve as true anyway to let the app function
      }, 5000);
    }).catch(err => {
      logger.error('[TranscriptionManager] Error sending initialization message:', err);
      chrome.runtime.onMessage.removeListener(responseListener);
      resolve(false);
    });
  });
}

/**
 * Provides a mock transcription result
 * @param {string} requestId - The request ID
 * @param {string} text - The mock text result
 * @param {boolean} usePort - Whether to attempt port messaging first
 */
function provideMockTranscription(requestId, text, usePort = false) {
  logger.log(`[TranscriptionManager] Providing mock transcription for: ${requestId}`);
  
  // Update the request status
  transcriptionRequestMap.set(requestId, { 
    status: 'completed', 
    result: text,
    endTime: Date.now(),
    isMock: true
  });
  
  // Create the message object
  const mockMessage = {
    type: 'TRANSCRIPTION_RESULT',
    payload: {
      requestId,
      result: text,
      isMockResult: true
    },
    fromManager: true // Tag the message to prevent loops
  };
  
  // Try to send via port first if requested
  if (usePort && offscreenManager.hasActivePort()) {
    offscreenManager.postMessageToOffscreen(mockMessage).then(sent => {
      if (!sent) {
        // Fall back to runtime messaging
        chrome.runtime.sendMessage(mockMessage).catch(err => 
          logger.warn(`[TranscriptionManager] Error sending mock result: ${err.message}`)
        );
      }
    });
  } else {
    // Use runtime messaging directly
    chrome.runtime.sendMessage(mockMessage).catch(err => 
      logger.warn(`[TranscriptionManager] Error sending mock result: ${err.message}`)
    );
  }
}

/**
 * Gets the status of a transcription request.
 * @param {string} requestId - The ID of the request to check.
 * @returns {Object|null} The status object or null if not found.
 */
export function getTranscriptionStatus(requestId) {
  return transcriptionRequestMap.get(requestId) || null;
}

/**
 * Gets all active transcription requests.
 * @returns {Array} An array of transcription request objects.
 */
export function getAllTranscriptionRequests() {
  return Array.from(transcriptionRequestMap.entries()).map(([id, data]) => ({
    id,
    ...data
  }));
}

/**
 * Handles runtime messages from offscreen document or other sources
 * @param {object} message - The message object
 * @param {object} sender - The sender object
 */
function handleRuntimeMessage(message, sender) {
  // Only process messages from our extension
  if (sender.id !== chrome.runtime.id) return;
  
  // Avoid message loops - only process messages from tabs or the offscreen document
  // and avoid processing messages that were sent by the manager itself
  if (message.fromManager || (!sender.tab && !sender.documentId)) {
    // This is either from another part of the service worker or is a message we forwarded
    return;
  }
  
  // If this is a transcription result, process it
  if (message.type === 'TRANSCRIPTION_RESULT') {
    logger.log(`[TranscriptionManager] Received transcription result via runtime messaging: ${message.payload?.requestId}`);
    handleTranscriptionResult(message);
    return true; // Keep the messaging channel open for response
  }
  
  // If this is a transcription error, process it
  if (message.type === 'TRANSCRIPTION_ERROR') {
    logger.log(`[TranscriptionManager] Received transcription error via runtime messaging: ${message.payload?.requestId}`);
    handleTranscriptionError(message);
    return true; // Keep the messaging channel open for response
  }
  
  // If this is a transcription progress update, process it
  if (message.type === 'TRANSCRIPTION_PROGRESS') {
    logger.log(`[TranscriptionManager] Received progress update via runtime messaging: ${message.payload?.requestId}`);
    // Forward progress updates directly to clients, but tag with fromManager to avoid loops
    chrome.runtime.sendMessage({
      ...message,
      fromManager: true
    }).catch(err => {
      logger.warn(`[TranscriptionManager] Error forwarding progress update: ${err.message}`);
    });
    return true; // Keep the messaging channel open for response
  }
}

// Set up listener for runtime messages related to transcription
chrome.runtime.onMessage.addListener(handleRuntimeMessage);

/**
 * Initializes the transcription manager
 */
export function initTranscriptionManager() {
  logger.log('[TranscriptionManager] Initializing transcription manager');
  
  // Ensure we're listening for runtime messages
  chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  
  logger.log('[TranscriptionManager] Transcription manager initialized');
}

// Initialize the manager when imported
initTranscriptionManager();
