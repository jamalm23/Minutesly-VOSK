// debug-helper.js - Simple debugging utilities
// This file is referenced but was missing, causing console errors

console.log('[DebugHelper] Loaded debug helper module');

// Provide basic debugging utilities
window.debugHelper = {
  log: function(message, data) {
    console.log(`[Debug] ${message}`, data || '');
  },
  
  error: function(message, error) {
    console.error(`[Debug Error] ${message}`, error || '');
  },
  
  timers: {},
  
  startTimer: function(name) {
    this.timers[name] = performance.now();
    this.log(`Timer started: ${name}`);
  },
  
  endTimer: function(name) {
    if (!this.timers[name]) {
      this.error(`Timer ${name} not found!`);
      return;
    }
    
    const duration = performance.now() - this.timers[name];
    this.log(`Timer ${name} completed in ${duration.toFixed(2)}ms`);
    delete this.timers[name];
    return duration;
  }
};
