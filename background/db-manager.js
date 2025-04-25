// background/db-manager.js

// Database constants
const DB_NAME = 'audioRecordingsDB';
const STORE_NAME = 'recordingsStore';
const DB_VERSION = 2;

/**
 * Initializes the IndexedDB database for storing audio recordings.
 * Creates the necessary object stores and indexes if they don't exist.
 * @returns {Promise<IDBDatabase>} A promise that resolves to the database instance.
 */
export async function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log(`[DBManager] Created ${STORE_NAME} object store`);
      }
    };
    
    request.onsuccess = (event) => {
      console.log(`[DBManager] Successfully opened database ${DB_NAME} v${DB_VERSION}`);
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      console.error('[DBManager] Error opening database:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Gets a connection to the database.
 * @returns {Promise<IDBDatabase>} A promise that resolves to the database instance.
 */
export async function getDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Saves a recording to the database.
 * @param {Object} recording - The recording object to save.
 * @returns {Promise<string>} A promise that resolves to the ID of the saved recording.
 */
export async function saveRecording(recording) {
  console.log(`[DBManager] Saving recording: ${recording.id}, metadata:`, recording.metadata);
  
  try {
    // Ensure DB is initialized
    const db = await getDb();
    
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Ensure recording has an ID and timestamp
        if (!recording.id) {
          recording.id = `recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          console.log(`[DBManager] Generated new ID for recording: ${recording.id}`);
        }
        
        if (!recording.timestamp) {
          recording.timestamp = Date.now();
          console.log(`[DBManager] Added timestamp to recording: ${recording.timestamp}`);
        }
        
        // Ensure metadata is properly structured
        if (!recording.metadata) {
          recording.metadata = {};
          console.log(`[DBManager] Created empty metadata object for recording`);
        }
        
        // Additional validation could be added here
        
        console.log(`[DBManager] Putting recording in store: ${recording.id}`);
        const request = store.put(recording);
        
        request.onsuccess = () => {
          console.log(`[DBManager] Recording saved successfully with ID: ${recording.id}`);
          resolve(recording.id);
        };
        
        request.onerror = (event) => {
          console.error(`[DBManager] Error saving recording:`, event.target.error);
          reject(event.target.error);
        };
        
        transaction.oncomplete = () => {
          console.log(`[DBManager] Transaction completed for recording: ${recording.id}`);
          
          // Notify any open popups that a recording has been saved
          try {
            chrome.runtime.sendMessage({
              action: 'notifyPopup',
              data: {
                type: 'recordingSaved',
                recordingId: recording.id
              }
            });
            console.log(`[DBManager] Sent recordingSaved notification for: ${recording.id}`);
          } catch (notifyError) {
            console.warn(`[DBManager] Could not notify popup of saved recording:`, notifyError);
          }
        };
        
        transaction.onerror = (event) => {
          console.error(`[DBManager] Transaction error:`, event.target.error);
        };
      } catch (innerError) {
        console.error(`[DBManager] Error in saveRecording transaction:`, innerError);
        reject(innerError);
      }
    });
  } catch (error) {
    console.error(`[DBManager] Error getting database in saveRecording:`, error);
    throw error;
  }
}

/**
 * Gets all recordings from the database.
 * @returns {Promise<Array>} A promise that resolves to an array of recordings.
 */
export async function getAllRecordings() {
  try {
    console.log('[DBManager] Getting all recordings');
    const db = await getDb();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => {
          console.log(`[DBManager] Successfully retrieved ${request.result.length} recordings`);
          resolve(request.result);
        };
        
        request.onerror = (event) => {
          console.error('[DBManager] Error in getAll request:', event.target.error);
          reject(event.target.error);
        };
        
        // Add transaction complete handler for debugging
        transaction.oncomplete = () => {
          console.log('[DBManager] Transaction completed successfully');
        };
        
        transaction.onerror = (event) => {
          console.error('[DBManager] Transaction error:', event.target.error);
          reject(event.target.error);
        };
      } catch (innerError) {
        console.error('[DBManager] Error creating transaction:', innerError);
        reject(innerError);
      }
    });
  } catch (error) {
    console.error('[DBManager] Error getting database connection:', error);
    return [];  // Return empty array instead of failing completely
  }
}

/**
 * Gets a recording by its ID.
 * @param {string} id - The ID of the recording to get.
 * @returns {Promise<Object>} A promise that resolves to the recording object.
 */
export async function getRecordingById(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result);
      } else {
        reject(new Error(`Recording with ID ${id} not found`));
      }
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Deletes a recording by its ID.
 * @param {string} id - The ID of the recording to delete.
 * @returns {Promise<boolean>} A promise that resolves to true if the recording was deleted.
 */
export async function deleteRecording(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      resolve(true);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
    
    transaction.oncomplete = () => {
      console.log(`[DBManager] Recording with ID ${id} deleted`);
    };
  });
}

/**
 * Updates a recording in the database.
 * @param {Object} recording - The recording object to update.
 * @returns {Promise<boolean>} A promise that resolves to true if the recording was updated.
 */
export async function updateRecording(recording) {
  if (!recording.id) {
    throw new Error('Recording must have an ID to update');
  }
  
  // First check if it exists
  try {
    await getRecordingById(recording.id);
  } catch (error) {
    throw new Error(`Cannot update: ${error.message}`);
  }
  
  // Then update it
  return saveRecording(recording).then(() => true);
}

// Export constants
export { DB_NAME, STORE_NAME, DB_VERSION };
