// Injected recorder script - this runs in page context
// This avoids Content Security Policy issues with inline scripts

// Self-executing function to avoid global scope pollution
(function() {
  // Create the SimpleRecorder object if it doesn't exist
  if (!window.SimpleRecorder) {
    console.log("[InjectedRecorder] Defining window.SimpleRecorder...");
    window.SimpleRecorder = {
      recording: false,
      stream: null,
      mediaRecorder: null,
      audioChunks: [],
      startTime: null,
      
      // Start recording audio
      startRecording: async function() {
        try {
          console.log("[InjectedRecorder] startRecording: Entry");
          if (this.recording) { throw new Error('Already recording'); }

          console.log("[InjectedRecorder] startRecording: Requesting getUserMedia...");
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          console.log("[InjectedRecorder] startRecording: getUserMedia SUCCESSFUL. Stream:", this.stream);

          console.log("[InjectedRecorder] startRecording: Creating MediaRecorder...");
          this.mediaRecorder = new MediaRecorder(this.stream);
          console.log("[InjectedRecorder] startRecording: MediaRecorder CREATED:", this.mediaRecorder);
          this.audioChunks = [];

          console.log("[InjectedRecorder] startRecording: Setting up event listeners...");
          // Set up data handler
          this.mediaRecorder.ondataavailable = (event) => {
            console.log(`[InjectedRecorder] ondataavailable fired. event.data.size: ${event.data.size}`);
            if (event.data.size > 0) {
              this.audioChunks.push(event.data);
              console.log(`[InjectedRecorder] Pushed chunk. Total chunks: ${this.audioChunks.length}`);
            }
          };
          // Set up error handler
          this.mediaRecorder.onerror = (event) => {
            console.error("[InjectedRecorder] MediaRecorder error:", event.error);
            window.postMessage({
              source: 'injected-recorder',
              action: 'recordingError',
              error: `MediaRecorder error: ${event.error.name} - ${event.error.message}`
            }, '*');
            this.cleanup();
          };
          // Set up stop handler
          this.mediaRecorder.onstop = () => {
            console.log("[InjectedRecorder] mediaRecorder.onstop triggered");
            const duration = Date.now() - this.startTime;
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            console.log(`[InjectedRecorder] Blob created, size: ${audioBlob.size}`);
            const filename = 'recording-' + Date.now() + '.webm';
            const timestamp = this.startTime;
            const url = window.location.href;
            const title = document.title;
            
            const metadata = { 
              filename: filename,
              duration: duration,
              timestamp: timestamp,
              url: url,
              title: title,
              blobSize: audioBlob.size,
              mimeType: audioBlob.type
            };
            console.log("[InjectedRecorder] Preparing to send metadata:", metadata);
            
            // Combine all chunks into a single blob
            const blob = new Blob(this.audioChunks, { type: audioBlob.type });
            console.log(`[InjectedRecorder] Blob created, size: ${blob.size}`);

            // Notify the content script with the recording metadata and blob
            try {
              console.log("[InjectedRecorder] Attempting to send recordingMetadataAvailable message...");
              window.postMessage({
                source: 'injected-recorder',
                action: 'recordingMetadataAvailable',
                metadata: metadata,
                blob: blob
              }, '*');
              console.log("[InjectedRecorder] Sent recordingMetadataAvailable message with blob.");
            } catch (postMessageError) {
              console.error("[InjectedRecorder] Error sending recordingMetadataAvailable message:", postMessageError);
            }
            
            this.cleanup();
          };
          console.log("[InjectedRecorder] startRecording: Event listeners set.");

          console.log("[InjectedRecorder] startRecording: Calling mediaRecorder.start(1000)...");
          this.mediaRecorder.start(1000);
          console.log("[InjectedRecorder] startRecording: mediaRecorder.start() called.");

          this.recording = true;
          this.startTime = Date.now();
          console.log("[InjectedRecorder] startRecording: State updated (recording=true).");

          // Notify the extension that recording has started
          console.log("[InjectedRecorder] Preparing to send recordingStarted message...");
          window.postMessage({
            source: 'injected-recorder',
            action: 'recordingStarted'
          }, '*');
          console.log("[InjectedRecorder] Sent recordingStarted message.");
          
          return true;
        } catch (error) {
          // Ensure the specific error is logged
          console.error('[InjectedRecorder] startRecording CATCH block error:', error.name, error.message, error); 
          this.cleanup();
          
          // Notify the extension of the error
          window.postMessage({
            source: 'injected-recorder',
            action: 'recordingError',
            error: error.message
          }, '*');
          
          throw error;
        }
      },
      
      // Stop recording and create downloadable file
      stopRecording: async function() {
        return new Promise((resolve, reject) => {
          console.log("[InjectedRecorder] Stopping recording");
          if (!this.recording || !this.mediaRecorder) {
            console.warn("[InjectedRecorder] stopRecording called but not recording or recorder missing.");
            this.cleanup();
            reject(new Error('Not recording or recorder missing'));
            return;
          }
          
          try {
            // Log state before stopping
            console.log(`[InjectedRecorder] Calling stop(). Current state: ${this.mediaRecorder?.state}`);
            
            // --- Define the onstop handler separately --- 
            const onStopHandler = () => {
              console.log("[InjectedRecorder] mediaRecorder.onstop triggered");
              const duration = Date.now() - this.startTime;
              const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
              console.log(`[InjectedRecorder] Blob created, size: ${audioBlob.size}`);
              
              // Regenerate metadata based on final blob and duration
              const metadata = { 
                filename: 'recording-' + this.startTime + '.webm',
                duration: duration,
                timestamp: this.startTime,
                url: window.location.href,
                title: document.title,
                blobSize: audioBlob.size,
                mimeType: audioBlob.type
              };
              console.log("[InjectedRecorder] Preparing to send metadata and blob:", metadata);
              
              // Send metadata and blob back to content script
              try {
                window.postMessage({
                  source: 'injected-recorder',
                  action: 'recordingMetadataAvailable',
                  metadata: metadata, 
                  blob: audioBlob
                }, '*');
                console.log("[InjectedRecorder] Sent recordingMetadataAvailable message with blob.");
              } catch (postMessageError) {
                 console.error("[InjectedRecorder] Error sending recordingMetadataAvailable message:", postMessageError);
              }
              
              this.cleanup();
              resolve({ success: true, message: "Recording stopped and data sent." });
            };
            
            // Assign the handlers
            this.mediaRecorder.onstop = onStopHandler;
            this.mediaRecorder.onerror = (event) => {
                 console.error("[InjectedRecorder] Error during stop/onstop:", event.error);
                 window.postMessage({ 
                     source: 'injected-recorder', 
                     action: 'recordingError', 
                     error: `Stop error: ${event.error.name}` 
                 }, '*');
                 this.cleanup();
                 reject(event.error);
             };
            
            // Stop the recorder if it's recording
            if (this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
                console.log("[InjectedRecorder] Sending stopAcknowledged message.")
                window.postMessage({ 
                    source: 'injected-recorder', 
                    action: 'stopAcknowledged' 
                }, '*');
            } else {
                console.warn(`[InjectedRecorder] stopRecording called but state is not 'recording': ${this.mediaRecorder?.state}`);
                this.cleanup();
                reject(new Error(`Cannot stop recording, state is ${this.mediaRecorder?.state}`));
            }
          } catch (error) {
            console.error('[InjectedRecorder] Error stopping:', error);
            this.cleanup();
            
            // Notify the extension of the error
            window.postMessage({
              source: 'injected-recorder',
              action: 'recordingError',
              error: error.message
            }, '*');
            
            reject(error);
          }
        });
      },
      
      // Clean up resources
      cleanup: function() {
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recording = false;
        this.startTime = null;
        console.log("[InjectedRecorder] Cleanup finished.")
      }
    };
    
    console.log("[InjectedRecorder] window.SimpleRecorder DEFINED.");

    // --- Move Listener Registration Inside --- 
    console.log("[InjectedRecorder] Adding message listener...");
    window.addEventListener('message', function(event) {
      // Only process messages from the content script
      if (event.data && event.data.source === 'content-script-recorder') {
        const command = event.data.command;
        console.log(`[InjectedRecorder] Message listener received command: ${command}`);

        if (command === 'ping') {
          // Respond to ping to let content script know recorder is available
          window.postMessage({
            source: 'injected-recorder',
            action: 'pong'
          }, '*');
        } else if (command === 'startRecording') {
          console.log("[InjectedRecorder] Attempting to call SimpleRecorder.startRecording...");
          try {
              window.SimpleRecorder.startRecording().catch(e => {
                console.error("[InjectedRecorder] ASYNC error during startRecording:", e.name, e.message, e);
                 window.postMessage({ source: 'injected-recorder', action: 'recordingError', error: `Async start error: ${e.message}` }, '*');
              });
              console.log("[InjectedRecorder] Successfully called SimpleRecorder.startRecording() (async execution started).");
          } catch (syncError) {
              console.error("[InjectedRecorder] SYNC error calling SimpleRecorder.startRecording:", syncError);
               window.postMessage({ source: 'injected-recorder', action: 'recordingError', error: `Sync start error: ${syncError.message}` }, '*');
          }
        } else if (command === 'stopRecording') {
          console.log("[InjectedRecorder] Attempting to call SimpleRecorder.stopRecording...");
          try {
              window.SimpleRecorder.stopRecording().catch(e => {
                console.error("[InjectedRecorder] ASYNC error during stopRecording:", e.name, e.message, e);
                 window.postMessage({ source: 'injected-recorder', action: 'recordingError', error: `Async stop error: ${e.message}` }, '*');
              });
               console.log("[InjectedRecorder] Successfully called SimpleRecorder.stopRecording() (async execution started).");
          } catch (syncError) {
              console.error("[InjectedRecorder] SYNC error calling SimpleRecorder.stopRecording:", syncError);
               window.postMessage({ source: 'injected-recorder', action: 'recordingError', error: `Sync stop error: ${syncError.message}` }, '*');
          }
        }
      }
    });
    console.log("[InjectedRecorder] Message listener ADDED.");
    // --- End Listener Registration --- 

    // Signal that the recorder is ready
    console.log("[InjectedRecorder] Sending recorderReady message...");
    window.postMessage({
      source: 'injected-recorder',
      action: 'recorderReady'
    }, '*');
    console.log("[InjectedRecorder] Sent recorderReady message.");

  } else {
      console.log("[InjectedRecorder] window.SimpleRecorder already defined. Listener should exist.")
  }
})();
