#!/usr/bin/env node

/**
 * Whisper WebAssembly Build Script
 * This script automates the process of downloading, building, and installing
 * the Whisper WebAssembly module for use in the Chrome extension.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

// Destination directory for WASM files
const wasmDir = path.join(__dirname, 'wasm');

// Ensure wasm directory exists
if (!fs.existsSync(wasmDir)) {
  fs.mkdirSync(wasmDir, { recursive: true });
  console.log(`Created directory: ${wasmDir}`);
}

// URLs for Whisper WebAssembly files
const WHISPER_MAIN_URL = 'https://raw.githubusercontent.com/ggerganov/whisper.cpp/master/examples/whisper.wasm/dist/whisper.wasm';
const WHISPER_MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin';
const WHISPER_JS_URL = 'https://raw.githubusercontent.com/ggerganov/whisper.cpp/master/examples/whisper.wasm/dist/main.js';

// Temp download paths
const TEMP_WASM_PATH = path.join(__dirname, 'whisper-temp.wasm');
const TEMP_MODEL_PATH = path.join(__dirname, 'ggml-tiny.en.bin');
const TEMP_JS_PATH = path.join(__dirname, 'main-temp.js');

// Function to download file with PowerShell (handles redirects well)
function downloadFileWithPowerShell(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading from ${url} using PowerShell...`);
    
    const downloadCmd = `
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      Invoke-WebRequest -Uri "${url}" -OutFile "${dest}" -UseBasicParsing
    `;
    
    const powershell = exec('powershell -Command "' + downloadCmd + '"');
    
    powershell.stdout.on('data', data => console.log(data.toString()));
    powershell.stderr.on('data', data => console.error(data.toString()));
    
    powershell.on('close', code => {
      if (code === 0) {
        console.log(`Download completed: ${dest}`);
        resolve();
      } else {
        console.error(`Download failed with code ${code}`);
        reject(new Error(`Download failed with code ${code}`));
      }
    });
  });
}

// Function to install the files in the wasm directory
function installFiles() {
  console.log('Installing files to wasm directory...');
  
  // Check if files were downloaded successfully
  let mainWasmExists = fs.existsSync(TEMP_WASM_PATH);
  let mainJsExists = fs.existsSync(TEMP_JS_PATH);
  let modelExists = fs.existsSync(TEMP_MODEL_PATH);
  
  console.log(`WASM file downloaded: ${mainWasmExists}`);
  console.log(`JS file downloaded: ${mainJsExists}`);
  console.log(`Model file downloaded: ${modelExists}`);
  
  // Copy files to wasm directory
  if (mainWasmExists) {
    fs.copyFileSync(TEMP_WASM_PATH, path.join(wasmDir, 'whisper.wasm'));
    console.log(`Installed whisper.wasm (${(fs.statSync(TEMP_WASM_PATH).size / (1024 * 1024)).toFixed(2)} MB)`);
    fs.unlinkSync(TEMP_WASM_PATH);
  }
  
  if (mainJsExists) {
    fs.copyFileSync(TEMP_JS_PATH, path.join(wasmDir, 'main.js'));
    fs.copyFileSync(TEMP_JS_PATH, path.join(wasmDir, 'whisper-tiny.js'));
    console.log(`Installed main.js and whisper-tiny.js (${(fs.statSync(TEMP_JS_PATH).size / (1024)).toFixed(2)} KB)`);
    fs.unlinkSync(TEMP_JS_PATH);
  }
  
  if (modelExists) {
    fs.copyFileSync(TEMP_MODEL_PATH, path.join(wasmDir, 'whisper-tiny.wasm'));
    console.log(`Installed whisper-tiny.wasm (${(fs.statSync(TEMP_MODEL_PATH).size / (1024 * 1024)).toFixed(2)} MB)`);
    fs.unlinkSync(TEMP_MODEL_PATH);
  }
  
  // List all files in the directory with their sizes
  console.log('\nFiles in wasm directory:');
  fs.readdirSync(wasmDir).forEach(file => {
    const stats = fs.statSync(path.join(wasmDir, file));
    const fileSize = stats.size;
    const fileSizeStr = fileSize > 1024 * 1024 
      ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB`
      : `${(fileSize / 1024).toFixed(2)} KB`;
    console.log(`${file} (${fileSizeStr})`);
  });
}

// Main function to download and install Whisper WASM files
async function main() {
  try {
    console.log('Starting download of Whisper WASM files...');
    
    // Download all files in parallel
    const downloadTasks = [
      downloadFileWithPowerShell(WHISPER_MAIN_URL, TEMP_WASM_PATH),
      downloadFileWithPowerShell(WHISPER_JS_URL, TEMP_JS_PATH),
      downloadFileWithPowerShell(WHISPER_MODEL_URL, TEMP_MODEL_PATH)
    ];
    
    await Promise.allSettled(downloadTasks);
    
    // Install files
    installFiles();
    console.log('\nFinished installing Whisper WASM files!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
