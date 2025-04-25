// visualization.js - Handles audio visualization rendering
// Part of the modularization effort to comply with file size limits (Rule III.4)

/**
 * Visualization module for audio representation
 * Handles drawing visualizations and animation
 */

// Expose these functions to other modules
export {
  initializeVisualization,
  drawPlaceholderVisualization,
  startVisualization,
  stopVisualization
};

let visualizationInterval = null;
let visualizationCanvas = null;
let visualizationContext = null;

/**
 * Initialize audio visualization canvas
 */
function initializeVisualization() {
  visualizationCanvas = document.getElementById('audioVisualization');
  
  if (!visualizationCanvas) {
    console.error('Visualization canvas not found');
    return;
  }
  
  visualizationContext = visualizationCanvas.getContext('2d');
  
  // Draw empty visualization to start
  drawPlaceholderVisualization(
    visualizationContext, 
    visualizationCanvas.width, 
    visualizationCanvas.height
  );
}

/**
 * Draw placeholder visualization (a flat line when not recording)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function drawPlaceholderVisualization(ctx, width, height) {
  if (!ctx) return;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw a simple flat line
  const centerY = height / 2;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Start audio visualization animation
 */
function startVisualization() {
  if (visualizationInterval) {
    clearInterval(visualizationInterval);
  }
  
  visualizationInterval = setInterval(() => {
    if (!visualizationCanvas || !visualizationContext) {
      console.error('Visualization canvas not initialized');
      return;
    }
    
    drawSimulatedVisualization(
      visualizationContext, 
      visualizationCanvas.width, 
      visualizationCanvas.height
    );
  }, 50);
}

/**
 * Draw a simulated audio visualization
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
function drawSimulatedVisualization(ctx, width, height) {
  if (!ctx) return;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  const centerY = height / 2;
  const barCount = 50;
  const barWidth = width / barCount;
  const maxBarHeight = height * 0.8;
  
  ctx.fillStyle = '#4285f4';
  
  for (let i = 0; i < barCount; i++) {
    // Create different heights with some randomness but a consistent pattern
    // Use sine wave with some noise for a natural audio-like appearance
    let barHeight = (
      Math.sin(Date.now() * 0.005 + i * 0.2) * 0.3 + 0.5 + 
      Math.random() * 0.2
    ) * maxBarHeight;
    
    // Make center bars taller than edges for a more pleasing visual
    const distanceFromCenter = Math.abs(i - barCount/2) / (barCount/2);
    barHeight *= (1 - distanceFromCenter * 0.3);
    
    // Draw bar
    const x = i * barWidth;
    const y = centerY - barHeight / 2;
    ctx.fillRect(x, y, barWidth - 1, barHeight);
  }
}

/**
 * Stop visualization animation
 */
function stopVisualization() {
  if (visualizationInterval) {
    clearInterval(visualizationInterval);
    visualizationInterval = null;
  }
  
  // Draw placeholder after stopping
  if (visualizationCanvas && visualizationContext) {
    drawPlaceholderVisualization(
      visualizationContext, 
      visualizationCanvas.width, 
      visualizationCanvas.height
    );
  }
}
