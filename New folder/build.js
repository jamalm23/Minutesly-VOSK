// Build script to bundle the lamejs library for the extension
const fs = require('fs');
const path = require('path');

// Create a simple wrapper for lamejs
const lamejsWrapper = `
// MP3 Encoder for Chrome Extension
// This is a bundled version of the lamejs library for use in content scripts

// Lamejs will be loaded via script tag
window.AudioRecorder = {
  // Convert raw audio data to MP3
  encodeToMP3: async function(audioBlob) {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Convert blob to array buffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Convert to MP3
      const mp3Blob = await this.audioBufferToMP3Blob(audioBuffer);
      
      return mp3Blob;
    } catch (error) {
      console.error('Error encoding to MP3:', error);
      // Fall back to original format if encoding fails
      return audioBlob;
    }
  },
  
  // Convert AudioBuffer to MP3 Blob using lamejs
  audioBufferToMP3Blob: function(audioBuffer) {
    return new Promise((resolve, reject) => {
      try {
        // Access the lamejs Mp3Encoder (loaded via script tag)
        if (!window.lamejs) {
          throw new Error('lamejs not loaded');
        }
        
        const channels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const bitRate = 128; // Default bitRate
        
        // Create MP3 encoder
        const mp3encoder = new window.lamejs.Mp3Encoder(channels, sampleRate, bitRate);
        
        // Process the raw audio data
        let samples;
        
        if (channels === 1) {
          // Mono
          const bufferData = audioBuffer.getChannelData(0);
          samples = this.convertToSamples(bufferData);
          
        } else {
          // Stereo (interleave channels)
          const leftChannel = audioBuffer.getChannelData(0);
          const rightChannel = audioBuffer.getChannelData(1);
          
          samples = this.convertToStereoSamples(leftChannel, rightChannel);
        }
        
        // Encode in chunks
        const mp3Data = [];
        const sampleBlockSize = 1152; // Must be multiple of 576 for lamejs
        
        for (let i = 0; i < samples.length; i += sampleBlockSize) {
          const sampleChunk = samples.subarray(i, i + sampleBlockSize);
          let mp3buf;
          
          if (channels === 1) {
            mp3buf = mp3encoder.encodeBuffer(sampleChunk);
          } else {
            // Split stereo channels
            const leftChunk = new Int16Array(sampleChunk.length / 2);
            const rightChunk = new Int16Array(sampleChunk.length / 2);
            
            for (let j = 0, k = 0; j < sampleChunk.length; j += 2, k++) {
              leftChunk[k] = sampleChunk[j];
              rightChunk[k] = sampleChunk[j + 1];
            }
            
            mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
          }
          
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }
        }
        
        // Get the last frames
        const lastMp3buf = mp3encoder.flush();
        if (lastMp3buf.length > 0) {
          mp3Data.push(new Uint8Array(lastMp3buf));
        }
        
        // Concatenate all chunks
        const totalLength = mp3Data.reduce((acc, buf) => acc + buf.length, 0);
        const result = new Uint8Array(totalLength);
        
        let offset = 0;
        for (const buf of mp3Data) {
          result.set(buf, offset);
          offset += buf.length;
        }
        
        // Create MP3 blob
        const mp3Blob = new Blob([result], { type: 'audio/mp3' });
        resolve(mp3Blob);
        
      } catch (error) {
        console.error('Error in MP3 encoding:', error);
        reject(error);
      }
    });
  },
  
  // Convert Float32Array to Int16Array (for PCM samples)
  convertToSamples: function(floatBuffer) {
    const output = new Int16Array(floatBuffer.length);
    
    for (let i = 0; i < floatBuffer.length; i++) {
      const s = Math.max(-1, Math.min(1, floatBuffer[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    return output;
  },
  
  // Convert two Float32Arrays to a single interleaved Int16Array
  convertToStereoSamples: function(leftBuffer, rightBuffer) {
    const length = leftBuffer.length + rightBuffer.length;
    const output = new Int16Array(length);
    
    for (let i = 0; i < leftBuffer.length; i++) {
      const left = Math.max(-1, Math.min(1, leftBuffer[i]));
      const right = Math.max(-1, Math.min(1, rightBuffer[i]));
      
      output[i * 2] = left < 0 ? left * 0x8000 : left * 0x7FFF;
      output[i * 2 + 1] = right < 0 ? right * 0x8000 : right * 0x7FFF;
    }
    
    return output;
  },
  
  // Generate filename for recorded audio
  generateFileName: function(prefix = 'recording', extension = 'mp3') {
    const date = new Date();
    const dateStr = date.toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
    return \`\${prefix}-\${dateStr}-\${timeStr}.\${extension}\`;
  },
  
  // Download the audio blob
  downloadAudio: function(blob, filename) {
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename || this.generateFileName();
    
    // Append to DOM, click, and remove
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
};

// Create helper for recording
window.AudioRecorderHelper = {
  micRecorder: null,
  tabRecorder: null,
  micChunks: [],
  tabChunks: [],
  isRecording: false,
  micStream: null,
  tabStream: null,
  recordingStartTime: null,
  recordingType: 'tab', // 'mic', 'tab', or 'both'
  
  // Start recording
  startRecording: async function(type = 'tab') {
    if (this.isRecording) {
      throw new Error('Already recording');
    }
    
    this.recordingType = type;
    this.recordingStartTime = Date.now();
    this.micChunks = [];
    this.tabChunks = [];
    this.isRecording = true;
    
    try {
      // Set up appropriate recorders based on type
      if (type === 'mic' || type === 'both') {
        await this.setupMicRecording();
      }
      
      if (type === 'tab' || type === 'both') {
        await this.setupTabRecording();
      }
      
      return true;
    } catch (error) {
      this.stopRecording();
      throw error;
    }
  },
  
  // Setup microphone recording
  setupMicRecording: async function() {
    // Get user media for microphone
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    // Create media recorder
    this.micRecorder = new MediaRecorder(this.micStream);
    
    // Setup event handlers
    this.micRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.micChunks.push(event.data);
      }
    };
    
    // Start recording
    this.micRecorder.start(1000);
  },
  
  // Setup tab audio recording
  setupTabRecording: async function() {
    try {
      // For tab audio, we need to use getDisplayMedia
      this.tabStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,  // We need video track to initiate sharing
        audio: true
      });
      
      // Check if we have audio
      const audioTracks = this.tabStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio track available from screen sharing');
      }
      
      // Create a stream with only audio tracks
      const audioStream = new MediaStream(audioTracks);
      
      // Create media recorder
      this.tabRecorder = new MediaRecorder(audioStream);
      
      // Setup event handlers
      this.tabRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.tabChunks.push(event.data);
        }
      };
      
      // Start recording
      this.tabRecorder.start(1000);
      
      // Handle stream end
      this.tabStream.getVideoTracks()[0].onended = () => {
        if (this.isRecording) {
          this.stopRecording();
        }
      };
      
    } catch (error) {
      console.error('Error setting up tab recording:', error);
      throw error;
    }
  },
  
  // Stop recording and get resulting blobs
  stopRecording: async function() {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }
    
    return new Promise(async (resolve, reject) => {
      try {
        const results = {};
        
        // Stop microphone recording if active
        if (this.micRecorder && this.micRecorder.state !== 'inactive') {
          await this.stopRecorder(this.micRecorder);
          
          // Create blob from mic chunks
          if (this.micChunks.length > 0) {
            const micBlob = new Blob(this.micChunks, { type: 'audio/webm' });
            // Convert to MP3
            const micMp3 = await window.AudioRecorder.encodeToMP3(micBlob);
            results.mic = {
              blob: micMp3,
              duration: Date.now() - this.recordingStartTime,
              filename: window.AudioRecorder.generateFileName('mic-recording')
            };
          }
        }
        
        // Stop tab recording if active
        if (this.tabRecorder && this.tabRecorder.state !== 'inactive') {
          await this.stopRecorder(this.tabRecorder);
          
          // Create blob from tab chunks
          if (this.tabChunks.length > 0) {
            const tabBlob = new Blob(this.tabChunks, { type: 'audio/webm' });
            // Convert to MP3
            const tabMp3 = await window.AudioRecorder.encodeToMP3(tabBlob);
            results.tab = {
              blob: tabMp3,
              duration: Date.now() - this.recordingStartTime,
              filename: window.AudioRecorder.generateFileName('tab-recording')
            };
          }
        }
        
        // Clean up streams
        this.cleanupStreams();
        
        // Reset state
        this.isRecording = false;
        this.micChunks = [];
        this.tabChunks = [];
        
        resolve(results);
      } catch (error) {
        this.cleanupStreams();
        this.isRecording = false;
        reject(error);
      }
    });
  },
  
  // Stop a specific recorder
  stopRecorder: function(recorder) {
    return new Promise((resolve) => {
      if (recorder.state === 'inactive') {
        resolve();
        return;
      }
      
      recorder.onstop = () => {
        resolve();
      };
      
      recorder.stop();
    });
  },
  
  // Clean up media streams
  cleanupStreams: function() {
    // Stop all tracks in the microphone stream
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    
    // Stop all tracks in the tab stream
    if (this.tabStream) {
      this.tabStream.getTracks().forEach(track => track.stop());
      this.tabStream = null;
    }
    
    this.micRecorder = null;
    this.tabRecorder = null;
  },
  
  // Pause recording
  pauseRecording: function() {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }
    
    if (this.micRecorder && this.micRecorder.state === 'recording') {
      this.micRecorder.pause();
    }
    
    if (this.tabRecorder && this.tabRecorder.state === 'recording') {
      this.tabRecorder.pause();
    }
    
    return true;
  },
  
  // Resume recording
  resumeRecording: function() {
    if (!this.isRecording) {
      throw new Error('Not recording');
    }
    
    if (this.micRecorder && this.micRecorder.state === 'paused') {
      this.micRecorder.resume();
    }
    
    if (this.tabRecorder && this.tabRecorder.state === 'paused') {
      this.tabRecorder.resume();
    }
    
    return true;
  },
  
  // Get recording state
  getRecordingState: function() {
    if (!this.isRecording) {
      return 'inactive';
    }
    
    // Check if any recorder is paused
    if ((this.micRecorder && this.micRecorder.state === 'paused') || 
        (this.tabRecorder && this.tabRecorder.state === 'paused')) {
      return 'paused';
    }
    
    return 'recording';
  },
  
  // Get recording source
  getRecordingSource: function() {
    return this.recordingType;
  }
};
`;

// Write the file
fs.writeFileSync(path.join(__dirname, 'content', 'audio-recorder.js'), lamejsWrapper);
console.log('Audio recorder module created successfully');
