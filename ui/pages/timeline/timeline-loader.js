// Timeline Loader Script - Handles recording data fetching for the timeline view

document.addEventListener('DOMContentLoaded', () => {
    console.log('[Timeline] Page loaded, initializing timeline loader');
    
    // Get recording ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const recordingId = urlParams.get('id');
    
    if (!recordingId) {
        console.error('[Timeline] No recording ID provided in URL parameters');
        displayError('No recording ID provided. Please select a recording from the dashboard.');
        return;
    }
    
    console.log(`[Timeline] Loading recording with ID: ${recordingId}`);
    
    // Request the recording data from the service worker
    chrome.runtime.sendMessage({ 
        action: 'getRecordingById', 
        id: recordingId 
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[Timeline] Error fetching recording:', chrome.runtime.lastError);
            displayError(`Error loading recording: ${chrome.runtime.lastError.message}`);
            return;
        }
        
        if (!response || !response.success) {
            console.error('[Timeline] Error response from service worker:', response);
            displayError(`Error loading recording: ${response?.error || 'Unknown error'}`);
            return;
        }
        
        console.log('[Timeline] Recording data received:', response.recording);
        
        // Store the recording data in a global variable for the React timeline to access
        window.recordingData = response.recording;
        
        // Dispatch an event to notify the timeline component that data is ready
        const dataReadyEvent = new CustomEvent('recording-data-ready', { 
            detail: response.recording 
        });
        document.dispatchEvent(dataReadyEvent);
    });
});

// Display an error message on the page
function displayError(message) {
    // Check if root element exists
    const root = document.getElementById('root');
    if (!root) return;
    
    // Create error message container
    const errorContainer = document.createElement('div');
    errorContainer.className = 'timeline-error';
    errorContainer.style.cssText = 'padding: 20px; color: #721c24; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin: 20px; text-align: center;';
    
    // Add error icon
    const errorIcon = document.createElement('div');
    errorIcon.innerHTML = '⚠️';
    errorIcon.style.fontSize = '32px';
    errorContainer.appendChild(errorIcon);
    
    // Add error message
    const errorMessage = document.createElement('p');
    errorMessage.textContent = message;
    errorMessage.style.marginTop = '10px';
    errorContainer.appendChild(errorMessage);
    
    // Add back button
    const backButton = document.createElement('button');
    backButton.textContent = 'Back to Dashboard';
    backButton.style.cssText = 'margin-top: 15px; padding: 8px 16px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;';
    backButton.onclick = () => {
        window.location.href = chrome.runtime.getURL('ui/pages/dashboard.html');
    };
    errorContainer.appendChild(backButton);
    
    // Clear and append to root
    root.innerHTML = '';
    root.appendChild(errorContainer);
}
