// Script to download Whisper model file
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Destination directory and file paths
const wasmDir = path.join(__dirname, 'wasm');
const modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin';
const tempModelPath = path.join(__dirname, 'ggml-tiny.en.bin');
const targetWasmPath = path.join(wasmDir, 'whisper-tiny.wasm');

// Ensure wasm directory exists
if (!fs.existsSync(wasmDir)) {
  fs.mkdirSync(wasmDir, { recursive: true });
  console.log(`Created directory: ${wasmDir}`);
}

// Download model file using curl (better for large files)
console.log(`Downloading Whisper model from ${modelUrl}...`);
console.log(`This may take a while as the model is approximately 75MB.`);

const curlCmd = `curl -L "${modelUrl}" -o "${tempModelPath}"`;

const curlProcess = exec(curlCmd);

curlProcess.stdout.on('data', (data) => {
  console.log(data);
});

curlProcess.stderr.on('data', (data) => {
  // curl shows progress on stderr, so we'll just output it as is
  process.stderr.write(data);
});

curlProcess.on('close', (code) => {
  if (code === 0) {
    console.log(`Download completed successfully.`);
    
    // Check if the file was downloaded properly
    if (fs.existsSync(tempModelPath)) {
      const fileSize = fs.statSync(tempModelPath).size;
      console.log(`Downloaded file size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB`);
      
      if (fileSize < 1000000) {
        console.error('Error: Downloaded file is too small. It might not be a valid model file.');
        return;
      }
      
      // Copy the file to the target location
      fs.copyFileSync(tempModelPath, targetWasmPath);
      console.log(`Model file installed to: ${targetWasmPath}`);
      
      // Clean up the temporary file
      fs.unlinkSync(tempModelPath);
      console.log('Temporary file removed.');
      
      // List files in the wasm directory
      console.log('\nFiles in wasm directory:');
      fs.readdirSync(wasmDir).forEach(file => {
        const stats = fs.statSync(path.join(wasmDir, file));
        const fileSize = stats.size;
        const fileSizeStr = fileSize > 1024 * 1024 
          ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
          : `${(fileSize / 1024).toFixed(2)} KB`;
        console.log(`${file} (${fileSizeStr})`);
      });
    } else {
      console.error('Error: Download seemed to succeed but the file does not exist.');
    }
  } else {
    console.error(`Download failed with code ${code}`);
  }
});