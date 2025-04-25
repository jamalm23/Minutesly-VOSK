// Audio Transcription Extension - Database Module

// Database version and name
const DB_NAME = 'AudioTranscriptionDB';
const DB_VERSION = 1;

// Object store names
const STORES = {
  MEETINGS: 'meetings',
  RECORDINGS: 'recordings',
  TRANSCRIPTIONS: 'transcriptions',
  SUMMARIES: 'summaries',
  ACTION_ITEMS: 'actionItems'
};

// Initialize the database
export async function initializeDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    // Handle database upgrade (called when DB is created or version changes)
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores with indexes
      if (!db.objectStoreNames.contains(STORES.MEETINGS)) {
        const meetingsStore = db.createObjectStore(STORES.MEETINGS, { keyPath: 'id' });
        // Add indexes for common queries
        meetingsStore.createIndex('date', 'date', { unique: false });
        meetingsStore.createIndex('title', 'title', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.RECORDINGS)) {
        const recordingsStore = db.createObjectStore(STORES.RECORDINGS, { keyPath: 'id' });
        recordingsStore.createIndex('meetingId', 'meetingId', { unique: false });
        recordingsStore.createIndex('date', 'date', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.TRANSCRIPTIONS)) {
        const transcriptionsStore = db.createObjectStore(STORES.TRANSCRIPTIONS, { keyPath: 'id' });
        transcriptionsStore.createIndex('meetingId', 'meetingId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.SUMMARIES)) {
        const summariesStore = db.createObjectStore(STORES.SUMMARIES, { keyPath: 'id' });
        summariesStore.createIndex('meetingId', 'meetingId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.ACTION_ITEMS)) {
        const actionItemsStore = db.createObjectStore(STORES.ACTION_ITEMS, { keyPath: 'id' });
        actionItemsStore.createIndex('meetingId', 'meetingId', { unique: false });
        actionItemsStore.createIndex('assignee', 'assignee', { unique: false });
        actionItemsStore.createIndex('completed', 'completed', { unique: false });
        actionItemsStore.createIndex('dueDate', 'dueDate', { unique: false });
      }
    };
    
    // Handle success
    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };
    
    // Handle errors
    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject('Failed to open database: ' + event.target.error);
    };
  });
}

// Generic function to add item to a store
export async function addItem(storeName, item) {
  const db = await initializeDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Add the item
    const request = store.add(item);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      console.error(`Error adding item to ${storeName}:`, event.target.error);
      reject(`Failed to add item to ${storeName}: ${event.target.error}`);
    };
    
    // Close the database when the transaction is complete
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Generic function to get item by id
export async function getItem(storeName, id) {
  const db = await initializeDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    
    // Get the item
    const request = store.get(id);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      console.error(`Error getting item from ${storeName}:`, event.target.error);
      reject(`Failed to get item from ${storeName}: ${event.target.error}`);
    };
    
    // Close the database when the transaction is complete
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Generic function to update item
export async function updateItem(storeName, item) {
  const db = await initializeDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Update the item
    const request = store.put(item);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      console.error(`Error updating item in ${storeName}:`, event.target.error);
      reject(`Failed to update item in ${storeName}: ${event.target.error}`);
    };
    
    // Close the database when the transaction is complete
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Generic function to delete item
export async function deleteItem(storeName, id) {
  const db = await initializeDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Delete the item
    const request = store.delete(id);
    
    request.onsuccess = (event) => {
      resolve(true);
    };
    
    request.onerror = (event) => {
      console.error(`Error deleting item from ${storeName}:`, event.target.error);
      reject(`Failed to delete item from ${storeName}: ${event.target.error}`);
    };
    
    // Close the database when the transaction is complete
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Get all items from a store
export async function getAllItems(storeName) {
  const db = await initializeDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    
    // Get all items
    const request = store.getAll();
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      console.error(`Error getting all items from ${storeName}:`, event.target.error);
      reject(`Failed to get all items from ${storeName}: ${event.target.error}`);
    };
    
    // Close the database when the transaction is complete
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Get items by index
export async function getItemsByIndex(storeName, indexName, value) {
  const db = await initializeDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    
    // Get items by index
    const request = index.getAll(value);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      console.error(`Error getting items by index from ${storeName}:`, event.target.error);
      reject(`Failed to get items by index from ${storeName}: ${event.target.error}`);
    };
    
    // Close the database when the transaction is complete
    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Save a meeting
export async function saveMeeting(meeting) {
  // Ensure it has an ID and date
  if (!meeting.id) {
    meeting.id = 'meeting_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  if (!meeting.date) {
    meeting.date = new Date().toISOString();
  }
  
  return addItem(STORES.MEETINGS, meeting);
}

// Save a recording
export async function saveRecording(recording) {
  // Ensure it has an ID and date
  if (!recording.id) {
    recording.id = 'recording_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  if (!recording.date) {
    recording.date = new Date().toISOString();
  }
  
  return addItem(STORES.RECORDINGS, recording);
}

// Get recordings for a meeting
export async function getRecordingsForMeeting(meetingId) {
  return getItemsByIndex(STORES.RECORDINGS, 'meetingId', meetingId);
}

// Get meetings in date range
export async function getMeetingsInDateRange(startDate, endDate) {
  const allMeetings = await getAllItems(STORES.MEETINGS);
  
  // Filter by date
  return allMeetings.filter(meeting => {
    const meetingDate = new Date(meeting.date);
    return meetingDate >= startDate && meetingDate <= endDate;
  });
}

// Get recent meetings
export async function getRecentMeetings(limit = 10) {
  const allMeetings = await getAllItems(STORES.MEETINGS);
  
  // Sort by date descending
  return allMeetings
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

// Get database storage statistics
export async function getStorageStats() {
  const stats = {
    meetingsCount: 0,
    recordingsCount: 0,
    recordingsSizeBytes: 0,
    transcriptionsCount: 0
  };
  
  // Get counts for each store
  stats.meetingsCount = (await getAllItems(STORES.MEETINGS)).length;
  
  const recordings = await getAllItems(STORES.RECORDINGS);
  stats.recordingsCount = recordings.length;
  
  // Calculate total size of recordings
  stats.recordingsSizeBytes = recordings.reduce((total, recording) => {
    return total + (recording.sizeBytes || 0);
  }, 0);
  
  stats.transcriptionsCount = (await getAllItems(STORES.TRANSCRIPTIONS)).length;
  
  return stats;
}

// Delete all data for a meeting
export async function deleteMeetingData(meetingId) {
  // Delete associated data first
  const recordings = await getItemsByIndex(STORES.RECORDINGS, 'meetingId', meetingId);
  for (const recording of recordings) {
    await deleteItem(STORES.RECORDINGS, recording.id);
  }
  
  const transcriptions = await getItemsByIndex(STORES.TRANSCRIPTIONS, 'meetingId', meetingId);
  for (const transcription of transcriptions) {
    await deleteItem(STORES.TRANSCRIPTIONS, transcription.id);
  }
  
  const summaries = await getItemsByIndex(STORES.SUMMARIES, 'meetingId', meetingId);
  for (const summary of summaries) {
    await deleteItem(STORES.SUMMARIES, summary.id);
  }
  
  const actionItems = await getItemsByIndex(STORES.ACTION_ITEMS, 'meetingId', meetingId);
  for (const actionItem of actionItems) {
    await deleteItem(STORES.ACTION_ITEMS, actionItem.id);
  }
  
  // Finally delete the meeting itself
  return deleteItem(STORES.MEETINGS, meetingId);
}

// Export database stores for use throughout the app
export const STORES_EXPORT = STORES;
