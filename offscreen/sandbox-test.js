// Function to log messages
function log(message, isError = false) {
    const logElement = document.getElementById('log');
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    
    if (isError) {
      entry.style.color = 'red';
    }
    
    logElement.appendChild(entry);
    logElement.scrollTop = logElement.scrollHeight;
    console.log(message);
  }
  
  // Test eval function
  function testEval() {
    log('Testing eval()...');
    
    try {
      const result = eval('2 + 2');
      log(`eval('2 + 2') = ${result}`, false);
      log('✅ eval() is working in this sandbox!');
    } catch (error) {
      log(`❌ eval() is blocked: ${error.message}`, true);
    }
  }
  
  // Test Function constructor
  function testFunction() {
    log('Testing Function constructor...');
    
    try {
      const add = new Function('a', 'b', 'return a + b');
      const result = add(2, 3);
      log(`new Function('a', 'b', 'return a + b')(2, 3) = ${result}`, false);
      log('✅ Function constructor is working in this sandbox!');
    } catch (error) {
      log(`❌ Function constructor is blocked: ${error.message}`, true);
    }
  }
  
  // Test CSP status
  function testCSP() {
    log('Testing Content Security Policy status...');
    
    // Check meta tag
    const metaTags = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
    if (metaTags.length > 0) {
      log(`Found ${metaTags.length} CSP meta tags in document:`, false);
      
      metaTags.forEach((tag, index) => {
        log(`  ${index + 1}. ${tag.content}`);
      });
    } else {
      log('No CSP meta tags found in document.');
    }
    
    // Try to determine if there's an active CSP
    try {
      // This should be blocked by CSP if it's active
      const script = document.createElement('script');
      script.textContent = 'console.log("Inline script executed")';
      document.head.appendChild(script);
      
      log('Inline script appended to document head.');
      
      // Check if we can create a blob URL and load it
      const blob = new Blob(['console.log("Blob script executed")'], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      
      const scriptElement = document.createElement('script');
      scriptElement.src = url;
      scriptElement.onload = () => log('✅ Blob URL script loaded successfully');
      scriptElement.onerror = (e) => log('❌ Blob URL script failed to load', true);
      document.head.appendChild(scriptElement);
      
      log('Blob URL script appended to document head.');
    } catch (error) {
      log(`Error during CSP test: ${error.message}`, true);
    }
  }
  
  // Set up event handlers
  document.getElementById('testEval').addEventListener('click', testEval);
  document.getElementById('testFunction').addEventListener('click', testFunction);
  document.getElementById('testCSP').addEventListener('click', testCSP);
  
  // Log when loaded
  log('Sandbox test page loaded.');
  log('Click the buttons above to test various sandbox features.');