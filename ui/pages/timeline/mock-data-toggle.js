// Global variable to track mock data state
window.useMockData = true;

// Create and inject the toggle UI
function createMockDataToggle() {
    // Create the styles
    const style = document.createElement("style");
    style.textContent = `
        .mock-data-toggle {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background-color: white;
            padding: 8px 12px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            font-family: sans-serif;
            font-size: 14px;
            display: flex;
            align-items: center;
        }
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 46px;
            height: 24px;
            margin-left: 10px;
        }
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 24px;
        }
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        input:checked + .toggle-slider {
            background-color: #4285f4;
        }
        input:checked + .toggle-slider:before {
            transform: translateX(22px);
        }
    `;
    document.head.appendChild(style);
    
    // Create the toggle UI
    const toggleDiv = document.createElement("div");
    toggleDiv.className = "mock-data-toggle";
    toggleDiv.innerHTML = `
        <span>Use Mock Data</span>
        <label class="toggle-switch">
            <input type="checkbox" id="mockDataToggle" checked>
            <span class="toggle-slider"></span>
        </label>
    `;
    document.body.insertBefore(toggleDiv, document.body.firstChild);
}

// Setup function that runs when the DOM is loaded
function setupMockDataToggle() {
    // Create the toggle UI
    createMockDataToggle();
    
    const urlParams = new URLSearchParams(window.location.search);
    
    // Initialize mock data toggle from URL parameter or localStorage
    const mockDataParam = urlParams.get("mock");
    if (mockDataParam !== null) {
        window.useMockData = mockDataParam === "true";
    } else {
        // Check if we have a saved preference
        const savedPreference = localStorage.getItem("useMockData");
        if (savedPreference !== null) {
            window.useMockData = savedPreference === "true";
        }
    }
    
    // Update the toggle to match the current state
    const mockToggle = document.getElementById("mockDataToggle");
    if (mockToggle) {
        mockToggle.checked = window.useMockData;
        
        // Add event listener to the toggle
        mockToggle.addEventListener("change", function() {
            window.useMockData = this.checked;
            // Save preference to localStorage
            localStorage.setItem("useMockData", window.useMockData);
            
            // Reload the page to apply the setting
            // Preserve other URL parameters
            const currentParams = new URLSearchParams(window.location.search);
            currentParams.set("mock", window.useMockData);
            window.location.search = currentParams.toString();
        });
    }
    
    // Make the mock data preference available to the React app
    window.getMockDataPreference = function() {
        return window.useMockData;
    };
}

// Register the DOMContentLoaded event listener
document.addEventListener("DOMContentLoaded", setupMockDataToggle);

// Log that the script has loaded
console.log("Mock data toggle script loaded");
