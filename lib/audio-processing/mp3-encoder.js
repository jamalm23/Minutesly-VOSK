// MP3 Encoder utility using lamejs
import lamejs from 'lamejs';

/**
 * Convert raw audio data (Float32Array) to MP3 format
 * @param {Float32Array} audioData - Raw audio data
 * @param {number} sampleRate - Audio sample rate
 * @param {number} channels - Number of audio channels (1 or 2)
 * @param {number} bitRate - MP3 bit rate (128 is default)
 * @returns {Uint8Array} - MP3 encoded data
 */
export function encodeToMP3(audioData, sampleRate = 44100, channels = 1, bitRate = 128) {
  // Create MP3 encoder
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitRate);
  
  // Process the float audio data to 16-bit PCM
  const samples = convertToSamples(audioData);
  
  // Determine chunk size (must be multiple of channels)
  const sampleBlockSize = 1152; 
  
  // Encode and collect MP3 chunks
  const mp3Data = [];
  
  for (let i = 0; i < samples.length; i += sampleBlockSize) {
    const sampleChunk = samples.subarray(i, i + sampleBlockSize);
    let mp3buf;
    
    if (channels === 1) {
      mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    } else {
      // Split stereo channels
      const leftChannel = new Int16Array(sampleChunk.length / 2);
      const rightChannel = new Int16Array(sampleChunk.length / 2);
      
      for (let j = 0, k = 0; j < sampleChunk.length; j += 2, k++) {
        leftChannel[k] = sampleChunk[j];
        rightChannel[k] = sampleChunk[j + 1];
      }
      
      mp3buf = mp3encoder.encodeBuffer(leftChannel, rightChannel);
    }
    
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }
  
  // Get the last frames and add them
  const lastMp3buf = mp3encoder.flush();
  if (lastMp3buf.length > 0) {
    mp3Data.push(lastMp3buf);
  }
  
  // Concatenate all MP3 data
  const totalLength = mp3Data.reduce((acc, buf) => acc + buf.length, 0);
  const result = new Uint8Array(totalLength);
  
  let offset = 0;
  for (const buf of mp3Data) {
    result.set(buf, offset);
    offset += buf.length;
  }
  
  return result;
}

/**
 * Convert Float32Array audio data to Int16Array 
 * @param {Float32Array} audioData - Raw audio data from WebAudio API
 * @returns {Int16Array} - PCM 16-bit audio data
 */
function convertToSamples(audioData) {
  const samples = new Int16Array(audioData.length);
  
  // Convert -1.0 - 1.0 range to -32768 - 32767 range
  for (let i = 0; i < audioData.length; i++) {
    // Clamp value to -1.0 - 1.0
    const s = Math.max(-1, Math.min(1, audioData[i]));
    // Convert to 16-bit signed int
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  return samples;
}

/**
 * Convert AudioBuffer to MP3 Blob
 * @param {AudioBuffer} audioBuffer - Web Audio API AudioBuffer
 * @returns {Blob} - MP3 data as Blob 
 */
export function audioBufferToMP3Blob(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  
  // Get audio data from each channel and merge if needed
  let audioData;
  
  if (channels === 1) {
    audioData = audioBuffer.getChannelData(0);
  } else {
    // Combine all channels into a single interleaved array
    const length = audioBuffer.length * channels;
    audioData = new Float32Array(length);
    
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < channels; channel++) {
        audioData[(i * channels) + channel] = audioBuffer.getChannelData(channel)[i];
      }
    }
  }
  
  // Encode to MP3
  const mp3Data = encodeToMP3(audioData, sampleRate, channels);
  
  // Return as Blob
  return new Blob([mp3Data], { type: 'audio/mp3' });
}

/**
 * Convert a Blob of audio data (e.g., WebM) to MP3
 * @param {Blob} blob - Audio data blob
 * @returns {Promise<Blob>} - Promise resolving to MP3 blob
 */
export async function convertBlobToMP3(blob) {
  // Create audio context
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Convert blob to array buffer
  const arrayBuffer = await blob.arrayBuffer();
  
  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Convert to MP3
  return audioBufferToMP3Blob(audioBuffer);
}
