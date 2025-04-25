// This script should be included BEFORE vosk-browser.js
// It creates a mock IndexedDB implementation that uses memory storage instead

console.log('Loading memory-only patch for Vosk');

// Create a simple in-memory storage to replace IndexedDB
const inMemoryStorage = {
  data: {},
  transaction: function() {
    return {
      objectStore: function() {
        return {
          put: function(data) {
            // Create a promise that resolves immediately
            return new Promise((resolve) => {
              // Store data in memory
              inMemoryStorage.data[data.url] = data.array;
              console.log('Stored data for:', data.url);
              resolve();
            });
          },
          get: function(url) {
            // Create a promise that resolves with the data
            return new Promise((resolve) => {
              if (inMemoryStorage.data[url]) {
                console.log('Retrieved data for:', url);
                resolve({url: url, array: inMemoryStorage.data[url]});
              } else {
                console.log('No data found for:', url);
                resolve(undefined);
              }
            });
          }
        };
      }
    };
  }
};

// Mock IDBFactory
class MockIDBFactory {
  open() {
    console.log('Using in-memory storage instead of IndexedDB');
    // Return a promise that resolves with our mock DB
    return Promise.resolve({
      transaction: inMemoryStorage.transaction,
      objectStoreNames: {
        contains: function() { return true; }
      },
      createObjectStore: function() {
        return {};
      }
    });
  }
}

// Replace the real indexedDB with our mock version
// This will be used by Vosk when it tries to access IndexedDB
window.realIndexedDB = window.indexedDB;
window.indexedDB = new MockIDBFactory();

console.log('IndexedDB replaced with in-memory storage for Vosk');