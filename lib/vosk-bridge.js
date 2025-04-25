/**
 * vosk-bridge.js
 * A bridge script to ensure consistent access to the Vosk API based on the original WASM implementation.
 * This bridges between the vosk-browser.js API and our expected interface.
 */

(function() {
  console.log('[VoskBridge] Initializing Vosk Bridge...');
  
  // Wait for the main vosk-browser.js to initialize
  function checkVoskAvailability() {
    if (typeof Vosk !== 'undefined') {
      console.log('[VoskBridge] Vosk global object found, setting up bridge');
      initBridge();
    } else {
      console.log('[VoskBridge] Waiting for Vosk to be defined...');
      setTimeout(checkVoskAvailability, 50);
    }
  }
  
  function initBridge() {
    // Create a standardized API that works regardless of how Vosk is exported
    try {
      console.log('[VoskBridge] Vosk API structure:', Object.keys(Vosk));
      
      // Add Recognizer compatibility layer if not present
      if (!Vosk.SpeechRecognizer) {
        console.log('[VoskBridge] Adding SpeechRecognizer compatibility layer');
        
        // Define SpeechRecognizer using Vosk.Model and Vosk.createModel
        Vosk.SpeechRecognizer = function(options) {
          console.log('[VoskBridge] Creating SpeechRecognizer with options:', options);
          
          const modelPath = options.model;
          const sampleRate = options.sampleRate || 16000;
          
          // Create an object that mimics the expected SpeechRecognizer interface
          const recognizer = {
            _model: null,
            _modelPath: modelPath,
            _sampleRate: sampleRate,
            _initialized: false,
            _callbacks: {
              onresult: null,
              onerror: null,
              onload: null
            },
            
            // Initialize and load the model
            async _init() {
              try {
                console.log('[VoskBridge] Loading model from:', this._modelPath);
                
                // Use IndexedDB caching if available (as described in the document)
                let modelFromCache = false;
                try {
                  if (Vosk.loadModelFromCache) {
                    const cachedModel = await Vosk.loadModelFromCache(this._modelPath);
                    if (cachedModel) {
                      console.log('[VoskBridge] Found model in cache');
                      modelFromCache = true;
                    }
                  }
                } catch (cacheError) {
                  console.warn('[VoskBridge] Error checking cache:', cacheError);
                }
                
                // Create the model using the appropriate API
                this._model = await Vosk.createModel(this._modelPath);
                
                // Cache the model if not from cache already
                if (!modelFromCache && Vosk.cacheModel) {
                  try {
                    await Vosk.cacheModel(this._modelPath, this._model);
                    console.log('[VoskBridge] Model cached successfully');
                  } catch (cacheError) {
                    console.warn('[VoskBridge] Error caching model:', cacheError);
                  }
                }
                
                console.log('[VoskBridge] Model loaded successfully');
                this._initialized = true;
                
                // Call the onload callback
                if (typeof this._callbacks.onload === 'function') {
                  setTimeout(() => {
                    this._callbacks.onload();
                  }, 0);
                }
                
                return true;
              } catch (error) {
                console.error('[VoskBridge] Error loading model:', error);
                if (typeof this._callbacks.onerror === 'function') {
                  setTimeout(() => {
                    this._callbacks.onerror(error);
                  }, 0);
                }
                return false;
              }
            },
            
            // Start processing - mimics the original API
            start() {
              console.log('[VoskBridge] Starting recognition');
              // Initialization is handled automatically in the constructor
              this._init();
            },
            
            // Process audio data
            acceptWaveform(audioData) {
              if (!this._initialized || !this._model) {
                console.warn('[VoskBridge] Model not initialized, cannot process audio');
                return false;
              }
              
              try {
                // Convert typed array if needed (follow original WASM approach for buffer handling)
                let processedData = audioData;
                if (!(audioData instanceof Int16Array)) {
                  processedData = new Int16Array(audioData.buffer || audioData);
                }
                
                // Use the appropriate method from the Vosk API
                const result = this._model.acceptWaveform(processedData);
                
                // Get and process results if needed
                if (result && typeof this._callbacks.onresult === 'function') {
                  const resultData = this.result();
                  this._callbacks.onresult(resultData);
                }
                
                return result;
              } catch (error) {
                console.error('[VoskBridge] Error processing audio:', error);
                if (typeof this._callbacks.onerror === 'function') {
                  this._callbacks.onerror(error);
                }
                return false;
              }
            },
            
            // Legacy method for compatibility
            processBuffer(buffer, sampleRate, isLast) {
              console.log('[VoskBridge] processBuffer called with', buffer.length, 'samples');
              return this.acceptWaveform(buffer);
            },
            
            // Get recognition result
            result() {
              if (!this._initialized || !this._model) {
                console.warn('[VoskBridge] Model not initialized, returning empty result');
                return { text: '' };
              }
              
              try {
                return this._model.result();
              } catch (error) {
                console.error('[VoskBridge] Error getting result:', error);
                return { text: '' };
              }
            },
            
            // Get final recognition result
            finalResult() {
              if (!this._initialized || !this._model) {
                console.warn('[VoskBridge] Model not initialized, returning empty result');
                return { text: '' };
              }
              
              try {
                return this._model.finalResult ? 
                  this._model.finalResult() : 
                  this._model.result();
              } catch (error) {
                console.error('[VoskBridge] Error getting final result:', error);
                return { text: '' };
              }
            },
            
            // Reset the recognizer state
            reset() {
              if (this._initialized && this._model && typeof this._model.reset === 'function') {
                this._model.reset();
              }
            },
            
            // Free resources
            free() {
              if (this._initialized && this._model && typeof this._model.free === 'function') {
                this._model.free();
                this._model = null;
                this._initialized = false;
              }
            },
            
            // Event handlers using getter/setter pattern
            set onresult(callback) {
              this._callbacks.onresult = callback;
            },
            get onresult() {
              return this._callbacks.onresult;
            },
            
            set onerror(callback) {
              this._callbacks.onerror = callback;
            },
            get onerror() {
              return this._callbacks.onerror;
            },
            
            set onload(callback) {
              this._callbacks.onload = callback;
              // If already initialized, call the callback immediately
              if (this._initialized && typeof callback === 'function') {
                setTimeout(callback, 0);
              }
            },
            get onload() {
              return this._callbacks.onload;
            }
          };
          
          // Start initialization
          recognizer._init();
          
          return recognizer;
        };
        
        // Add VoskSpeechRecognition alias for backward compatibility
        window.VoskSpeechRecognition = Vosk.SpeechRecognizer;
        
        console.log('[VoskBridge] SpeechRecognizer compatibility layer added');
      }
      
      console.log('[VoskBridge] Bridge setup complete ✓');
    } catch (error) {
      console.error('[VoskBridge] Error setting up bridge:', error);
    }
  }
  
  // Start checking for Vosk
  checkVoskAvailability();
})();
