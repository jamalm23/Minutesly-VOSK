// AI Insights functionality
document.addEventListener("DOMContentLoaded", function() {
    // Function to switch to the AI Insights tab
    window.showAIInsights = function() {
        if (window.handleTabChange) {
            window.handleTabChange("aiinsights");
            return true;
        }
        return false;
    };

    // Check if we should directly show AI insights from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const showInsights = urlParams.get("insights") === "true";
    
    if (showInsights) {
        // Try to switch to insights tab with retry logic
        let attempts = 0;
        const maxAttempts = 5;
        
        const tryShowInsights = function() {
            attempts++;
            console.log(`Attempt ${attempts} to show AI insights tab`);
            
            if (window.showAIInsights()) {
                console.log("Successfully switched to AI insights tab");
            } else if (attempts < maxAttempts) {
                // Try again after delay
                setTimeout(tryShowInsights, 1000);
            } else {
                console.log("Failed to switch to AI insights tab after maximum attempts");
            }
        };
        
        // Start attempts after React has time to initialize
        setTimeout(tryShowInsights, 1500);
    }
});

console.log("AI Insights script loaded");
