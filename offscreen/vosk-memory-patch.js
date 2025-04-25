// Enhanced patching for Vosk to disable IndexedDB usage completely

console.log('ENHANCED VOSK PATCH: Initializing');

// Create a more invasive patch that modifies Vosk's behavior
(function() {
  // Store the original Worker constructor
  const OriginalWorker = window.Worker;
  
  // Create a patched Worker constructor
  window.Worker = function(scriptUrl, options) {
    console.log('ENHANCED VOSK PATCH: Creating Worker with URL:', scriptUrl);
    
    // If it's a blob URL (which is what Vosk uses), we need to modify it
    if (scriptUrl.startsWith('blob:')) {
      console.log('ENHANCED VOSK PATCH: Detected blob Worker');
      
      // Create an array to store any created workers for debugging
      if (!window._patchedWorkers) {
        window._patchedWorkers = [];
      }
      
      // Create the worker using the original constructor
      const worker = new OriginalWorker(scriptUrl, options);
      
      // Store for debugging
      window._patchedWorkers.push(worker);
      
      // Override the worker.postMessage method to intercept messages going to the worker
      const originalPostMessage = worker.postMessage;
      worker.postMessage = function(message) {
        // Modify any messages that contain file loading instructions
        // to disable IndexedDB usage
        if (message && typeof message === 'object') {
          console.log('ENHANCED VOSK PATCH: Intercepted worker message:', message);
          
          // If there's a loadModel message, modify it to disable cache
          if (message.command === 'init' || message.command === 'loadModel') {
            console.log('ENHANCED VOSK PATCH: Modifying worker init/loadModel message');
            message.disableCache = true;
            message.useIndexedDB = false;
          }
        }
        
        // Call the original postMessage with our modified message
        return originalPostMessage.apply(this, arguments);
      };
      
      return worker;
    }
    
    // For non-blob URLs, just use the original Worker constructor
    return new OriginalWorker(scriptUrl, options);
  };
  
  // Also disable IndexedDB completely
  // Store a reference to the real indexedDB
  window._realIndexedDB = window.indexedDB;
  
  // Replace with a dummy that throws errors
  window.indexedDB = {
    open: function() {
      console.log('ENHANCED VOSK PATCH: Blocked IndexedDB.open() call');
      
      // Instead of throwing an error, return a fake IDBOpenDBRequest that never succeeds
      const fakeRequest = {
        error: new Error('IndexedDB disabled by Vosk patch'),
        readyState: 'pending',
        result: null,
        transaction: null,
        source: null,
        onsuccess: null,
        onerror: null
      };
      
      // Trigger error asynchronously
      setTimeout(function() {
        if (typeof fakeRequest.onerror === 'function') {
          fakeRequest.onerror(new Event('error'));
        }
      }, 0);
      
      return fakeRequest;
    }
  };
  
  console.log('ENHANCED VOSK PATCH: Patched Worker constructor and disabled IndexedDB');
  
  // Create a MutationObserver to detect when the Vosk script is loaded
  // and apply additional patches directly to the Vosk object
  const observer = new MutationObserver(function(mutations) {
    if (window.Vosk) {
      console.log('ENHANCED VOSK PATCH: Vosk detected, applying additional patches');
      
      // Patch Vosk.createModel to disable cache
      const originalCreateModel = window.Vosk.createModel;
      window.Vosk.createModel = function(modelPath) {
        console.log('ENHANCED VOSK PATCH: createModel called with path:', modelPath);
        
        // Always use a fresh model, no caching
        return originalCreateModel.call(this, modelPath, {
          disableCache: true,
          useIndexedDB: false
        });
      };
      
      // No need to observe anymore
      observer.disconnect();
    }
  });
  
  // Start observing
  observer.observe(document.documentElement, {
    childList: true, 
    subtree: true
  });
})();

console.log('ENHANCED VOSK PATCH: Setup complete');