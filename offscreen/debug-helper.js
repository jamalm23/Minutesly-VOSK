/**
 * Debug Helper Script for Offscreen Document
 * This file provides debugging utilities for the offscreen document
 * to help diagnose communication issues with the service worker.
 */

console.log('OFFSCREEN DOCUMENT LOADED - from debug-helper.js');

document.addEventListener('DOMContentLoaded', () => {
  console.log('OFFSCREEN DOCUMENT FULLY LOADED');
  
  // Update the DOM visibly when loaded
  const log = document.getElementById('log');
  if (log) {
    log.innerHTML += `<div style="color:green">LOADED AT: ${new Date().toISOString()}</div>`;
  }
  
  // Log when messages are received via postMessage
  window.addEventListener('message', (event) => {
    console.log('OFFSCREEN RECEIVED MESSAGE:', event.data);
    if (log) {
      log.innerHTML += `<div>MESSAGE: ${JSON.stringify(event.data)}</div>`;
    }
  });
  
  // Listen for chrome runtime messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('OFFSCREEN CHROME MESSAGE:', message);
    if (log) {
      log.innerHTML += `<div>CHROME MSG: ${JSON.stringify(message)}</div>`;
    }
    // Always respond to confirm receipt
    sendResponse({received: true, from: 'offscreen'});
    return true;
  });

  // Add a button click handler for the keep-alive button
  const keepAliveBtn = document.getElementById('keepAliveBtn');
  if (keepAliveBtn) {
    keepAliveBtn.addEventListener('click', () => {
      const timestamp = new Date().toISOString();
      console.log(`Keep alive clicked at ${timestamp}`);
      if (log) {
        log.innerHTML += `<div style="color:blue">MANUAL KEEP ALIVE: ${timestamp}</div>`;
      }
      // Send a message to the service worker to confirm communication
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_DEBUG',
        action: 'MANUAL_KEEPALIVE',
        timestamp: Date.now()
      }, (response) => {
        console.log('Service worker response:', response);
        if (log) {
          log.innerHTML += `<div>SW RESPONSE: ${JSON.stringify(response)}</div>`;
        }
      });
    });
  }

  // Add manual test for sandbox communication
  // Add a test button to the control panel
  const controlPanel = document.querySelector('.control-panel');
  if (controlPanel) {
    const testBtn = document.createElement('button');
    testBtn.textContent = 'Test Sandbox';
    testBtn.style.marginLeft = '10px';
    testBtn.style.backgroundColor = '#ff9900';
    testBtn.addEventListener('click', () => {
      const timestamp = Date.now();
      console.log(`Testing sandbox communication at ${new Date(timestamp).toISOString()}`);
      if (log) {
        log.innerHTML += `<div style="color:orange">TESTING SANDBOX: ${timestamp}</div>`;
      }
      
      // Create a test iframe to the sandbox
      const iframe = document.createElement('iframe');
      iframe.src = chrome.runtime.getURL('offscreen/whisper-sandbox.html');
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.position = 'absolute';
      iframe.style.top = '-9999px';
      iframe.style.border = 'none';
      
      // Listen for messages from the iframe
      window.addEventListener('message', function sandboxListener(event) {
        console.log('Message from sandbox:', event.data);
        if (log) {
          log.innerHTML += `<div style="color:purple">SANDBOX MESSAGE: ${JSON.stringify(event.data)}</div>`;
        }
        
        // After receiving a message, we can respond back
        if (event.source) {
          event.source.postMessage({
            type: 'OFFSCREEN_TO_SANDBOX',
            message: 'Hello from offscreen!',
            timestamp
          }, '*');
        }
      });
      
      // Append to document
      document.body.appendChild(iframe);
      if (log) {
        log.innerHTML += `<div>Sandbox iframe added to document</div>`;
      }
    });
    controlPanel.appendChild(testBtn);
  }
  
  // Log important info about the context
  console.log('Extension ID:', chrome.runtime.id);
  if (log) {
    log.innerHTML += `<div>Extension ID: ${chrome.runtime.id}</div>`;
    log.innerHTML += `<div>URL: ${window.location.href}</div>`;
  }
});
