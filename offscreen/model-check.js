// Improved model-check.js - Comprehensive diagnostic script to check for Vosk model files

/**
 * Checks if a given file exists in the extension's directory
 * @param {string} filePath - Path to check
 * @returns {Promise<Object>} Object with status and optional content
 */
async function checkFileExists(filePath) {
    try {
      const response = await fetch(filePath);
      const result = {
        exists: response.ok,
        status: response.status,
        statusText: response.statusText
      };
      
      // For small files, include content
      if (response.ok) {
        if (filePath.endsWith('.json') || filePath.endsWith('README') || filePath.includes('.conf')) {
          result.content = await response.text();
        } else {
          result.contentType = response.headers.get('Content-Type');
          result.contentLength = response.headers.get('Content-Length');
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error checking file:', filePath, error);
      return {
        exists: false,
        error: error.message
      };
    }
  }
  
  /**
   * Thoroughly checks the Vosk model directory structure
   * @param {string} modelPath - Base path to the model directory
   * @returns {Promise<Object>} Detailed check results
   */
  async function checkModelDirectory(modelPath) {
    const results = {
      baseDir: modelPath,
      readme: await checkFileExists(`${modelPath}/README`),
      conf: await checkFileExists(`${modelPath}/conf/mfcc.conf`),
      am: {
        dir: `${modelPath}/am`,
        model: await checkFileExists(`${modelPath}/am/final.mdl`),
        tree: await checkFileExists(`${modelPath}/am/tree`)
      },
      graph: {
        dir: `${modelPath}/graph`,
        fst: await checkFileExists(`${modelPath}/graph/HCLG.fst`),
        phones: await checkFileExists(`${modelPath}/graph/phones.txt`)
      },
      ivector: {
        dir: `${modelPath}/ivector`,
        extractor: await checkFileExists(`${modelPath}/ivector/final.ie`)
      },
      valid: false
    };
    
    // Check if essential files exist
    results.valid = 
      results.readme.exists && 
      results.am.model.exists && 
      results.graph.fst.exists;
    
    return results;
  }
  
  /**
   * Checks for the existence and validity of Vosk model files
   * @returns {Promise<object>} Comprehensive object containing check results
   */
  async function checkVoskModelFiles() {
    const results = {
      models: [],
      wasm: {
        files: []
      },
      js: {
        files: []
      },
      diagnostics: {
        chromeRuntime: typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined',
        getURL: typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined' && typeof chrome.runtime.getURL === 'function',
        fetch: typeof fetch === 'function'
      }
    };
    
    // Add basic diagnostic info
    results.diagnostics.userAgent = navigator.userAgent;
    results.diagnostics.timeChecked = new Date().toISOString();
    
    // Get extension ID if available
    if (results.diagnostics.chromeRuntime) {
      results.diagnostics.extensionId = chrome.runtime.id;
    }
    
    // Check for model directories
    const modelPaths = [
      'wasm/vosk-model-en-us-0.22-lgraph',
      'wasm/vosk-model-small-en-us-0.15'
    ];
    
    for (const modelPath of modelPaths) {
      try {
        const fullPath = results.diagnostics.getURL ? chrome.runtime.getURL(modelPath) : modelPath;
        const modelCheck = await checkModelDirectory(fullPath);
        
        results.models.push({
          path: modelPath,
          fullPath: fullPath,
          results: modelCheck
        });
      } catch (error) {
        results.models.push({
          path: modelPath,
          error: error.message
        });
      }
    }
    
    // Check for WASM files
    const wasmPaths = [
      'offscreen/vosk.wasm',
      'wasm/vosk.wasm',
      'vosk.wasm'
    ];
    
    for (const wasmPath of wasmPaths) {
      try {
        const fullPath = results.diagnostics.getURL ? chrome.runtime.getURL(wasmPath) : wasmPath;
        const checkResult = await checkFileExists(fullPath);
        
        results.wasm.files.push({
          path: wasmPath,
          fullPath: fullPath,
          ...checkResult
        });
      } catch (error) {
        results.wasm.files.push({
          path: wasmPath,
          error: error.message
        });
      }
    }
    
    // Check for JS files
    const jsPaths = [
      'offscreen/vosk.final.js',
      'offscreen/vosk.js',
      'offscreen/vosk.wasm.js',
      'wasm/vosk.js'
    ];
    
    for (const jsPath of jsPaths) {
      try {
        const fullPath = results.diagnostics.getURL ? chrome.runtime.getURL(jsPath) : jsPath;
        const checkResult = await checkFileExists(fullPath);
        
        results.js.files.push({
          path: jsPath,
          fullPath: fullPath,
          ...checkResult
        });
      } catch (error) {
        results.js.files.push({
          path: jsPath,
          error: error.message
        });
      }
    }
    
    // Check for valid combinations
    results.wasm.valid = results.wasm.files.some(file => file.exists);
    results.js.valid = results.js.files.some(file => file.exists);
    results.valid = results.wasm.valid && results.js.valid && results.models.some(model => model.results?.valid);
    
    return results;
  }
  
  // Debug function to check Vosk model and print results
  async function debugVoskModel() {
    console.log('🔍 Starting Vosk model check...');
    
    // Use UI logger if available
    if (typeof window.logToUI === 'function') {
      window.logToUI('🔍 Starting Vosk model check...');
    }
    
    // Get model check results
    const results = await checkVoskModelFiles();
    
    console.log('🔍 Vosk model check results:', results);
    
    // Format results for UI display
    let uiMessage = '';
    
    // Check overall validity
    if (results.valid) {
      uiMessage += '✅ Vosk files configuration is valid\n\n';
    } else {
      uiMessage += '❌ Vosk files configuration is INVALID\n\n';
    }
    
    // Check for models
    const validModels = results.models.filter(m => m.results && m.results.valid);
    if (validModels.length > 0) {
      uiMessage += '✅ Found valid Vosk model(s):\n';
      validModels.forEach(model => {
        uiMessage += `   - ${model.path}\n`;
      });
    } else {
      uiMessage += '❌ No valid Vosk models found!\n';
      results.models.forEach(model => {
        if (model.results) {
          uiMessage += `   - ${model.path} (README: ${model.results.readme.exists ? '✓' : '✗'}, Model: ${model.results.am.model.exists ? '✓' : '✗'})\n`;
        } else if (model.error) {
          uiMessage += `   - ${model.path} (Error: ${model.error})\n`;
        }
      });
    }
    
    // Check for WASM file
    if (results.wasm.valid) {
      const validWasm = results.wasm.files.find(file => file.exists);
      uiMessage += `✅ Found WASM file: ${validWasm.path}\n`;
    } else {
      uiMessage += '❌ No WASM file found!\n';
      results.wasm.files.forEach(file => {
        uiMessage += `   - ${file.path} (${file.exists ? '✓' : '✗'})\n`;
      });
    }
    
    // Check for JS file
    if (results.js.valid) {
      const validJs = results.js.files.find(file => file.exists);
      uiMessage += `✅ Found JS file: ${validJs.path}\n`;
    } else {
      uiMessage += '❌ No JS file found!\n';
      results.js.files.forEach(file => {
        uiMessage += `   - ${file.path} (${file.exists ? '✓' : '✗'})\n`;
      });
    }
    
    // Additional diagnostics
    uiMessage += '\nDiagnostic Information:\n';
    uiMessage += `   - Extension ID: ${results.diagnostics.extensionId || 'Unknown'}\n`;
    uiMessage += `   - Chrome Runtime available: ${results.diagnostics.chromeRuntime ? '✓' : '✗'}\n`;
    uiMessage += `   - getURL function available: ${results.diagnostics.getURL ? '✓' : '✗'}\n`;
    uiMessage += `   - Fetch API available: ${results.diagnostics.fetch ? '✓' : '✗'}\n`;
    
    // Log to UI
    if (typeof window.logToUI === 'function') {
      window.logToUI(uiMessage);
    } else {
      console.log(uiMessage);
    }
    
    return results;
  }
  
  // Export for testing
  window.debugVoskModel = debugVoskModel;
  window.checkVoskModelFiles = checkVoskModelFiles;
  window.checkModelDirectory = checkModelDirectory;