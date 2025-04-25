# Script to copy Whisper WASM files to the extension
$whisperSourceDir1 = "C:\Users\jamal\whisper.cpp\build-wasm"
$whisperSourceDir2 = "C:\Users\jamal\whisper-repo\build-wasm"
$extensionWasmDir = ".\wasm"

# Show script execution path for debugging
Write-Host "Executing from: $(Get-Location)"

# Create destination directory if it doesn't exist
if (-not (Test-Path $extensionWasmDir)) {
    New-Item -ItemType Directory -Path $extensionWasmDir
    Write-Host "Created directory: $extensionWasmDir"
}

# Function to copy files if source directory exists
function CopyWhisperFiles($sourceDir) {
    if (Test-Path $sourceDir) {
        Write-Host "Found Whisper build directory: $sourceDir"
        
        # List all files in the source directory
        Write-Host "Files found in source directory:"
        Get-ChildItem -Path $sourceDir | Format-Table Name, Length, LastWriteTime
        
        $filesCopied = 0
        
        # Copy WASM files
        $wasmFiles = Get-ChildItem -Path $sourceDir -Filter "*.wasm"
        foreach ($file in $wasmFiles) {
            # Check if file size is reasonable (more than 100KB)
            if ($file.Length -gt 102400) {
                Copy-Item -Path $file.FullName -Destination "$extensionWasmDir\whisper-tiny.wasm" -Force
                Write-Host "Copied $($file.Name) ($([math]::Round($file.Length/1MB, 2)) MB) to $extensionWasmDir\whisper-tiny.wasm"
                $filesCopied++
            } else {
                Write-Host "Warning: Skipping $($file.Name) because it's too small ($([math]::Round($file.Length/1KB, 2)) KB)"
            }
        }
        
        # Copy JS files
        $jsFiles = Get-ChildItem -Path $sourceDir -Filter "*.js"
        foreach ($file in $jsFiles) {
            if ($file.Name -like "*whisper*" -or $file.Name -eq "main.js") {
                Copy-Item -Path $file.FullName -Destination $extensionWasmDir -Force
                Write-Host "Copied $($file.Name) ($([math]::Round($file.Length/1KB, 2)) KB) to $extensionWasmDir"
                $filesCopied++
            }
        }
        
        return $filesCopied -gt 0
    }
    return $false
}

# Try to copy from the first source directory
$copied = CopyWhisperFiles $whisperSourceDir1

# If first directory doesn't exist or no files copied, try the second one
if (-not $copied) {
    Write-Host "Trying alternative source directory..."
    $copied = CopyWhisperFiles $whisperSourceDir2
}

# If neither directory exists
if (-not $copied) {
    # Check build directory without the -wasm suffix
    $altSourceDir1 = "C:\Users\jamal\whisper.cpp\build"
    Write-Host "Trying $altSourceDir1..."
    $copied = CopyWhisperFiles $altSourceDir1
    
    if (-not $copied) {
        $altSourceDir2 = "C:\Users\jamal\whisper-repo\build"
        Write-Host "Trying $altSourceDir2..."
        $copied = CopyWhisperFiles $altSourceDir2
    }
}

# Also try the emscripten directory which might contain the binaries
if (-not $copied) {
    $emscriptenDir = "C:\Users\jamal\whisper.cpp\examples\emscripten"
    Write-Host "Trying Emscripten examples directory..."
    $copied = CopyWhisperFiles $emscriptenDir
}

# List what we have in the wasm directory
Write-Host "`nCurrent files in the extension's wasm directory:"
Get-ChildItem -Path $extensionWasmDir | Format-Table Name, Length, LastWriteTime

if (-not $copied) {
    Write-Host "`nCouldn't find valid Whisper build files in the expected locations."
    Write-Host "Please make sure you've built Whisper.cpp with Emscripten as per the instructions in install-prerequisites.md"
    Write-Host "After building, please update this script with the correct path to your build directory."
}