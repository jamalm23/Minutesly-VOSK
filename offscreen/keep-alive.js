// Auto-click handler that simulates user interaction
let keepAliveCounter = 0;
let statusSpan;

// Set up auto-clicker for the keep-alive button
function setupAutoClick() {
  const btn = document.getElementById('keepAliveBtn');
  statusSpan = document.getElementById('status');
  
  if (btn) {
    // Periodically click the button to simulate user activity
    setInterval(() => {
      btn.click();
    }, 10000); // Every 10 seconds
    
    // Handle the actual click event
    btn.addEventListener('click', () => {
      keepAliveCounter++;
      const timestamp = new Date().toLocaleTimeString();
      statusSpan.textContent = `Kept alive ${keepAliveCounter} times (Last: ${timestamp})`;
      
      // Create and play a short beep to maintain audio activity
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.001; // Very quiet
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.01); // Very short duration
      } catch (e) {
        console.error("Failed to create audio:", e);
      }
    });
    
    // Initial click to start things off
    setTimeout(() => btn.click(), 500);
  }
}

// Run setup when DOM is loaded
document.addEventListener('DOMContentLoaded', setupAutoClick); 