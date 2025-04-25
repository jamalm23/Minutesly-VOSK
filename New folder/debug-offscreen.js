/**
 * Offscreen Document Debugging Helper
 * 
 * This script helps debug the offscreen document by providing functions
 * to inspect its state and logs. Run this in the DevTools console
 * after launching your extension.
 */

// Function to help find and inspect the offscreen document
async function inspectOffscreenDocument() {
  // Get the extension ID from the current URL
  const extensionId = chrome.runtime.id;
  console.log('Extension ID:', extensionId);
  
  // Get all extension views
  const views = chrome.extension.getViews();
  console.log('Total extension views:', views.length);
  
  // Look for the offscreen document
  const offscreenDocuments = views.filter(view => 
    view.location.href.includes('offscreen.html')
  );
  
  if (offscreenDocuments.length > 0) {
    console.log('✅ Found', offscreenDocuments.length, 'offscreen document(s)');
    
    // Display the first offscreen document's URL
    console.log('URL:', offscreenDocuments[0].location.href);
    
    // Try to get cross-origin isolated status
    try {
      const isCrossOriginIsolated = offscreenDocuments[0].crossOriginIsolated;
      console.log('crossOriginIsolated:', isCrossOriginIsolated);
      
      if (isCrossOriginIsolated) {
        console.log('✅ Cross-origin isolation is enabled - SharedArrayBuffer should work');
      } else {
        console.log('❌ Cross-origin isolation is NOT enabled - SharedArrayBuffer will not work');
      }
    } catch (e) {
      console.error('Cannot check crossOriginIsolated:', e);
    }
    
    // Check if we can see the global variables in the offscreen document
    try {
      console.log('Whisper module initialized:', !!offscreenDocuments[0].whisperModule);
      console.log('Audio queue length:', offscreenDocuments[0].audioQueue.length);
      console.log('Is processing:', offscreenDocuments[0].isProcessing);
    } catch (e) {
      console.error('Cannot access offscreen document variables:', e);
    }
    
    return offscreenDocuments[0];
  } else {
    console.log('❌ No offscreen document found');
    
    // Check if the offscreen API is available
    if (chrome.offscreen) {
      console.log('✅ chrome.offscreen API is available');
      
      // Check if there's an existing document
      const hasDocument = await chrome.offscreen.hasDocument();
      console.log('Has offscreen document:', hasDocument);
      
      if (!hasDocument) {
        console.log('ℹ️ Try using the transcription test page to create the offscreen document');
      }
    } else {
      console.log('❌ chrome.offscreen API is NOT available');
    }
    
    return null;
  }
}

// Function to manually trigger transcription
async function testOffscreenTranscription() {
  // Create a simple audio buffer with a tone
  const sampleRate = 16000;
  const duration = 2; // seconds
  const frequency = 440; // Hz (A4 note)
  
  const audioBuffer = new Float32Array(sampleRate * duration);
  for (let i = 0; i < audioBuffer.length; i++) {
    audioBuffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
  }
  
  // Convert to base64 data URL
  const blob = new Blob([audioBuffer], { type: 'audio/wav' });
  const reader = new FileReader();
  
  reader.onload = async () => {
    const dataUrl = reader.result;
    console.log('Generated test audio data URL, length:', dataUrl.length);
    
    // Send to the service worker
    const requestId = 'debug-test-' + Date.now();
    chrome.runtime.sendMessage({
      action: 'TRANSCRIBE_AUDIO',
      requestId,
      audioDataUrl: dataUrl,
      options: { modelSize: 'tiny' }
    }, response => {
      console.log('Transcription request response:', response);
    });
    
    // Listen for responses
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'OFFSCREEN_TRANSCRIBER_EVENT' && message.requestId === requestId) {
        console.log('Received transcription event:', message.event, message.data);
      }
    });
  };
  
  reader.readAsDataURL(blob);
}

// Print instructions
console.log('== Offscreen Document Debugging Tools ==');
console.log('Run inspectOffscreenDocument() to check offscreen document status');
console.log('Run testOffscreenTranscription() to test with a generated tone');
console.log('\nTo inspect the offscreen document directly:');
console.log('1. Go to chrome://extensions');
console.log('2. Find your extension and click "Service Worker" under Inspect views');
console.log('3. In the DevTools that opens, go to Application tab > Frames');
console.log('4. Look for an offscreen.html entry and click "inspect"');
