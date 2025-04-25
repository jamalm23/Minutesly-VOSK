// This script injects a floating panel into the current tab

document.addEventListener('DOMContentLoaded', function() {
  console.log('Action popup loaded, injecting floating panel into current tab');
  
  // Get the current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (chrome.runtime.lastError) {
      console.error('Error querying tabs:', chrome.runtime.lastError);
      document.querySelector('.message').textContent = 'Error: ' + chrome.runtime.lastError.message;
      document.querySelector('.spinner').style.display = 'none';
      return;
    }
    
    if (!tabs || tabs.length === 0) {
      console.error('No active tab found');
      document.querySelector('.message').textContent = 'Error: No active tab found';
      document.querySelector('.spinner').style.display = 'none';
      return;
    }
    
    const activeTab = tabs[0];
    console.log('Active tab:', activeTab);
    
    // For security reasons, we can only inject into certain URLs
    if (!activeTab.url || !(
        activeTab.url.startsWith('http://') || 
        activeTab.url.startsWith('https://') || 
        activeTab.url.startsWith('file://')
    )) {
      console.error('Cannot inject into this page type:', activeTab.url);
      document.querySelector('.message').textContent = 'Cannot run on this page type';
      document.querySelector('.spinner').style.display = 'none';
      return;
    }
    
    // Inject the content script to create the floating panel
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      function: injectFloatingPanel
    }).then(() => {
      console.log('Floating panel injected successfully');
      // Close the popup after a short delay
      setTimeout(() => {
        window.close();
      }, 500);
    }).catch(error => {
      console.error('Error injecting floating panel:', error);
      document.querySelector('.message').textContent = 'Error: ' + error.message;
      document.querySelector('.spinner').style.display = 'none';
    });
  });
});

// Function to be injected into the page
function injectFloatingPanel() {
  // Check if panel already exists
  if (document.getElementById('audio-transcription-panel')) {
    // Panel already exists, make it visible and slide it in
    const panel = document.getElementById('audio-transcription-panel');
    panel.style.display = 'block';
    
    // Slide in animation
    setTimeout(() => {
      panel.style.transform = 'translateX(0)';
    }, 50); // Small delay to ensure display block has taken effect
    
    return;
  }
  
  // Add slider stylesheet
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slide-in {
      from { transform: translateX(420px); }
      to { transform: translateX(0); }
    }
    
    @keyframes slide-out {
      from { transform: translateX(0); }
      to { transform: translateX(420px); }
    }
    
    #audio-transcription-panel {
      transition: transform 0.3s ease-out;
    }
    
    #audio-transcription-panel.closing {
      transform: translateX(420px) !important;
    }
  `;
  document.head.appendChild(style);
  
  // Create iframe container
  const panel = document.createElement('div');
  panel.id = 'audio-transcription-panel';
  panel.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100%;
    z-index: 2147483647;
    border: none;
    box-shadow: -2px 0 8px rgba(0,0,0,0.2);
    overflow: hidden;
    background: white;
    transform: translateX(420px);
    transition: transform 0.3s ease-out;
  `;
  
  // Create header bar for the panel
  const header = document.createElement('div');
  header.style.cssText = `
    height: 40px;
    background: #f1f1f1;
    border-bottom: 1px solid #ddd;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 15px;
    cursor: grab;
  `;
  
  // Create title for the header
  const title = document.createElement('div');
  title.textContent = 'Audio Transcription';
  title.style.cssText = `
    font-family: Arial, sans-serif;
    font-size: 14px;
    font-weight: bold;
    color: #333;
  `;
  
  // Create close button
  const closeButton = document.createElement('div');
  closeButton.style.cssText = `
    width: 20px;
    height: 20px;
    color: #666;
    text-align: center;
    line-height: 20px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 20px;
  `;
  closeButton.textContent = '×';
  closeButton.onclick = function() {
    // Slide out animation
    panel.classList.add('closing');
    
    // Hide after animation completes
    setTimeout(() => {
      panel.style.display = 'none';
      panel.classList.remove('closing');
    }, 300);
  };
  
  // Create iframe for the popup content
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `
    width: 100%;
    height: calc(100% - 40px); /* Subtract header height */
    border: none;
  `;
  
  // Set the iframe source to the extension's popup.html
  iframe.src = chrome.runtime.getURL('popup/popup.html');
  
  // Add elements to the DOM
  header.appendChild(title);
  header.appendChild(closeButton);
  panel.appendChild(header);
  panel.appendChild(iframe);
  document.body.appendChild(panel);
  
  // Slide in animation after a brief delay
  setTimeout(() => {
    panel.style.transform = 'translateX(0)';
  }, 100);
  
  // Add message listener to handle extension communication
  window.addEventListener('message', function(event) {
    // Only accept messages from the iframe
    if (event.source !== iframe.contentWindow) {
      return;
    }
    
    console.log('[Panel] Received message from iframe:', event.data);
    
    // Handle messages from the iframe
    if (event.data && event.data.action === 'closePanel') {
      // Slide out animation
      panel.classList.add('closing');
      
      // Hide after animation completes
      setTimeout(() => {
        panel.style.display = 'none';
        panel.classList.remove('closing');
      }, 300);
    }
    // Forward recording-related messages to the content script
    else if (event.data && ['startRecording', 'stopRecording', 'pauseRecording', 'resumeRecording'].includes(event.data.action)) {
      console.log('[Panel] Forwarding recording message to content script:', event.data);
      // Forward the message to the content script
      document.dispatchEvent(new CustomEvent('recording-action', { detail: event.data }));
    }
  });

  // Listen for messages from the content script that need to be forwarded to the iframe
  document.addEventListener('recording-result', function(event) {
    console.log('[Panel] Forwarding result to iframe:', event.detail);
    iframe.contentWindow.postMessage(event.detail, '*');
  });
}
