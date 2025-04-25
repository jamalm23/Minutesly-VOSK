import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft, Play, Pause, Download, Share2, Trash2, MoreVertical, MessageSquare,
  Clock, CheckCircle, AlertCircle, Tag, Flag, ChevronDown, Search, Edit3, Bookmark,
  ThumbsUp, ThumbsDown, Mail, Calendar, List, Plus, ExternalLink, MessageCircle,
  Send, X, Filter, BarChart2
} from 'lucide-react';

import TimelineVisualization from './TimelineVisualization'; // Import the new component
import TimelineEntry from './TimelineEntry'; // Import the new component
import MomentDetailsPanel from './MomentDetailsPanel'; // Import the new component
import SearchAndFilterControls from './SearchAndFilterControls'; 
import AudioWaveform from './AudioWaveform'; // Import the new AudioWaveform component
import DataVisualizationPanel from './visualizations/DataVisualizationPanel';
import AIInsightsPanel from './AIInsightsPanel'; // Import the new AI Insights Panel

// --- Mock Data Fetching (Keep for fallback/demo if needed, but remove direct usage) --- 
// const fetchMockMeetingData = async (recordingId) => { ... };

// --- Chrome Storage Helper (Keep for UI state persistence) ---
const loadStateFromStorage = async (key, defaultValue) => {
  try {
    const result = await chrome.storage.sync.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  } catch (error) {
    console.error(`Error loading state for ${key} from storage:`, error);
    return defaultValue;
  }
};

const saveStateToStorage = async (key, value) => {
  try {
    await chrome.storage.sync.set({ [key]: value });
  } catch (error) {
    console.error(`Error saving state for ${key} to storage:`, error);
  }
};

// --- Helper to save/load full meeting data (REMOVED - Now handled via background) ---
// const loadMeetingDataFromStorage = async (recordingId) => { ... };
// const saveMeetingDataToStorage = async (recordingId, data) => { ... };

// --- New Function to fetch data via background message ---
const getTimelineDataFromBackground = (recordingId, useMockData = true) => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ 
      action: 'getTimelineData', 
      recordingId: recordingId,
      useMockData: useMockData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message to background:", chrome.runtime.lastError);
        return reject(new Error(chrome.runtime.lastError.message || 'Communication error'));
      }
      if (response?.success) {
        console.log("Received timeline data from background:", response.data);
        resolve(response.data);
      } else {
        console.error("Background script reported error:", response?.error);
        reject(new Error(response?.error || 'Failed to get data from background'));
      }
    });
  });
};

// --- New function to save comments via background (if needed - currently updates local state and saves full data) ---
// If you want comments saved incrementally or via background, add a message handler here.
// For now, we keep the existing comment logic which saves the *entire* updated meetingData.
// This requires a way to update the background's version of meetingData or DB.
// Simpler approach for now: let background handle initial load, let frontend manage/save updates.


const RecordingDetails = () => {
  const [meetingData, setMeetingData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- State Variables (with persistence where applicable) ---
  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioSrc, setAudioSrc] = useState('');
  const [isAudioLoaded, setIsAudioLoaded] = useState(false);

  // UI State
  const [currentTab, setCurrentTab] = useState('timeline'); // Default to timeline
  const [viewMode, setViewMode] = useState('standard'); // Persisted
  const [showInsights, setShowInsights] = useState(true); // Changed default to true to show insights panel
  const [timelineSearch, setTimelineSearch] = useState('');
  const [selectedMoment, setSelectedMoment] = useState(null); // Persisted for current session
  const [commentInput, setCommentInput] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    questions: true, decisions: true, objections: true,
    actions: true, feedback: true, all: true
  }); // Persisted

  // Refs
  const audioRef = useRef(null);

  // Additional state variables
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // --- Effects --- 
  // Fetch initial data and load persistent state
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const recordingId = urlParams.get('id') || 'mock123'; // Still need ID
        
        // Check for mock data preference
        let useMockData = true; // Default to true if not specified
        if (window.getMockDataPreference !== undefined) {
          useMockData = window.getMockDataPreference();
        } else if (urlParams.get('mock') !== null) {
          useMockData = urlParams.get('mock') === 'true';
        }
        
        console.log(`Using mock data: ${useMockData}`);

        // Fetch initial data from background script
        console.log(`Requesting timeline data for ${recordingId} from background...`);
        const data = await getTimelineDataFromBackground(recordingId, useMockData);
        setMeetingData(data); // Set state with data received from background
        
        // Now separately fetch the actual audio data URL
        try {
          console.log(`Requesting audio data for ${recordingId} from background...`);
          // Send a message to fetch the actual audio blob
          chrome.runtime.sendMessage({ 
            action: 'getRecordingBlob', 
            id: recordingId 
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("Error fetching audio data:", chrome.runtime.lastError);
              return;
            }
            
            if (response?.success && response.dataUrl) {
              console.log("Received audio data URL from background");
              setAudioSrc(response.dataUrl);
            } else {
              // If we can't get a real audio URL, use the mock one as fallback
              if (data?.audioUrl) {
                console.log("Using mock audio URL from timeline data:", data.audioUrl);
                setAudioSrc(data.audioUrl);
              }
            }
          });
        } catch (audioError) {
          console.error("Error fetching audio data:", audioError);
          // Still use the mock URL as fallback
          if (data?.audioUrl) {
            setAudioSrc(data.audioUrl);
          }
        }

        // Load persistent UI state (filters, selected moment etc. - keep using sync storage)
        const storedViewMode = await loadStateFromStorage('viewMode', 'standard');
        setViewMode(storedViewMode);
        const storedShowInsights = await loadStateFromStorage('showInsights', true);
        setShowInsights(storedShowInsights);
        const storedFilters = await loadStateFromStorage('activeFilters', activeFilters);
        setActiveFilters(storedFilters);
        // Load selected moment (still okay to use sync storage for this UI state)
        const storedSelectedMoment = await loadStateFromStorage(`selectedMoment_${recordingId}`, null);
        setSelectedMoment(storedSelectedMoment);

      } catch (err) {
        console.error("Error initializing component:", err);
        setError(err.message || "Failed to load meeting data.");
      } finally {
        setIsLoading(false);
      }
    };
    initialize();
  }, []); 

  // Audio player sync effect
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play()
          .catch(error => {
            console.error("Error playing audio:", error);
            setIsPlaying(false);
          });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Handle playback speed changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Update UI with current time from audio element
  useEffect(() => {
    const updateCurrentTime = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
    };
    
    // Update every 250ms when playing
    let timeUpdateInterval;
    if (isPlaying) {
      timeUpdateInterval = setInterval(updateCurrentTime, 250);
    }
    
    return () => {
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
      }
    };
  }, [isPlaying]);

  // Persist UI state changes (Keep these as they are UI-specific)
  useEffect(() => { saveStateToStorage('viewMode', viewMode); }, [viewMode]);
  useEffect(() => { saveStateToStorage('showInsights', showInsights); }, [showInsights]);
  useEffect(() => { saveStateToStorage('activeFilters', activeFilters); }, [activeFilters]);
  useEffect(() => {
    // Persist selected moment ID (UI state)
    if (meetingData?.id) { 
      saveStateToStorage(`selectedMoment_${meetingData.id}`, selectedMoment);
    }
  }, [selectedMoment, meetingData?.id]);

  // Add the handleTabChange function to window object for external access
  useEffect(() => {
    // Make the handleTabChange function available globally
    window.handleTabChange = (tab) => {
      console.log('Tab change requested to:', tab);
      setCurrentTab(tab);
    };
    
    // Make the handleSeek function available globally
    window.handleSeek = handleSeek;
    
    // Make the handleMomentSelect function available globally
    window.handleMomentSelect = handleMomentSelect;
    
    // Make the handlePlayPause function available globally for autoplay functionality
    window.handlePlayPause = handlePlayPause;
    
    // Create placeholder data for AI Insights
    window.getAIInsightsData = () => {
      return {
        transcript: meetingData?.transcript || [],
        topics: meetingData?.topics || [],
        sentimentData: meetingData?.sentimentData || [],
        actionItems: (meetingData?.meetingMemoryMoments || []).filter(m => m.type === 'action'),
        keyMoments: (meetingData?.meetingMemoryMoments || []).filter(m => m.type === 'decision' || m.type === 'objection')
      };
    };
    
    // Cleanup when component unmounts
    return () => {
      window.handleTabChange = undefined;
      window.handleSeek = undefined;
      window.handleMomentSelect = undefined;
      window.handlePlayPause = undefined;
      window.getAIInsightsData = undefined;
    };
  }, []);

  // --- Event Handlers & Logic ---
  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play()
          .catch(error => {
            console.error("Error playing audio:", error);
          });
      }
      setIsPlaying(!isPlaying);
    }
  };
  const handleTabChange = (tab) => setCurrentTab(tab);
  const handleSeek = (time) => {
    console.log("Seek requested to:", time);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };
  const toggleViewMode = () => setViewMode(prev => prev === 'standard' ? 'compact' : 'standard');
  const toggleInsights = () => setShowInsights(!showInsights);
  const handleFilterChange = (filter) => setActiveFilters(prev => ({ ...prev, [filter]: !prev[filter] }));
  const handleMomentSelect = (momentId) => {
    console.log("Moment selected:", momentId);
    setSelectedMoment(momentId);
    if (momentId && meetingData?.meetingMemoryMoments) {
      const moment = meetingData.meetingMemoryMoments.find(m => m.id === momentId);
      if (moment?.timestamp !== undefined) {
        handleSeek(moment.timestamp); // Seek audio to selected moment's time
      }
    }
  };
  const handleAddComment = (momentId, commentText) => {
    if (!meetingData?.meetingMemoryMoments || !meetingData.id) return;

    let updatedMeetingData = null;

    // Update local state first for immediate UI feedback
    setMeetingData(currentData => {
      const updatedMoments = currentData.meetingMemoryMoments.map(moment => {
        if (moment.id === momentId) {
          const newComment = {
            user: 'ME', 
            text: commentText,
            timestamp: Date.now(),
          };
          const existingComments = moment.comments || [];
          return { ...moment, comments: [...existingComments, newComment] };
        }
        return moment;
      });
      updatedMeetingData = { ...currentData, meetingMemoryMoments: updatedMoments };
      return updatedMeetingData;
    });

    // Clear the input field
    setCommentInput('');

    // Asynchronously save the updated meeting data back to background script
    if (updatedMeetingData) {
      console.log("Saving meeting data update with new comment to background script");
      chrome.runtime.sendMessage({ 
        action: 'saveMeetingDataUpdate', 
        recordingId: meetingData.id, 
        updatedData: updatedMeetingData 
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error saving meeting data update:", chrome.runtime.lastError);
          return;
        }
        
        if (response?.success) {
          console.log("Successfully saved meeting data update");
        } else {
          console.error("Background script reported error when saving update:", response?.error);
        }
      });
    }
  };
  const handleSearchChange = (e) => setTimelineSearch(e.target.value);

  const handleAudioLoaded = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
      setIsAudioLoaded(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  // Format time in MM:SS format
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Rendering --- 
  if (isLoading) {
    // Basic loading indicator (can be improved with Material spinner later)
    return <div className="flex justify-center items-center h-screen"><p className="text-gray-500">Loading...</p></div>;
  }

  if (error) {
    // Basic error display
    return <div className="flex justify-center items-center h-screen text-red-600 p-4 text-center"><p>{error}</p></div>;
  }

  if (!meetingData) {
    // Basic empty state
    return <div className="flex justify-center items-center h-screen"><p className="text-gray-500">No meeting data available.</p></div>;
  }
  
  // --- Material-Inspired Header --- (Simplified, using elevation)
  const renderHeader = () => (
    <header className="bg-white shadow-md p-3 flex justify-between items-center sticky top-0 z-20">
      <div className="flex items-center space-x-3">
        <button 
          onClick={() => window.close()} 
          title="Back" 
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-medium text-gray-800 truncate" title={meetingData.title}>{meetingData.title}</h1>
      </div>
      <div className="flex items-center space-x-1">
        {/* Material Icon Buttons (using Lucide) */}
        <button 
          title="Share" 
          onClick={() => {
            // Create a shareable link or summary
            const shareText = `Meeting: ${meetingData.title}\nDate: ${new Date(meetingData.date).toLocaleDateString()}\nSummary: ${meetingData.summary || 'No summary available'}`;
            
            // Use the navigator clipboard API to copy to clipboard
            navigator.clipboard.writeText(shareText)
              .then(() => {
                alert('Meeting summary copied to clipboard!');
              })
              .catch(err => {
                console.error('Failed to copy: ', err);
                alert('Could not copy to clipboard');
              });
          }}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <Share2 size={20}/>
        </button>
        <button 
          title="Download Full Transcript" 
          onClick={() => {
            // Prepare transcript data
            const transcriptData = meetingData.meetingMemoryMoments.map(moment => 
              `[${new Date(moment.timestamp * 1000).toLocaleTimeString()}] ${moment.speaker}: ${moment.text}`
            ).join('\n\n');
            
            const fileContent = `Meeting: ${meetingData.title}\nDate: ${new Date(meetingData.date).toLocaleDateString()}\n\nTranscript:\n${transcriptData}`;
            
            // Create downloadable file
            const element = document.createElement('a');
            const file = new Blob([fileContent], {type: 'text/plain'});
            element.href = URL.createObjectURL(file);
            element.download = `${meetingData.title.replace(/\s+/g, '_')}_transcript.txt`;
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
          }}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <Download size={20}/>
        </button>
        <button 
          title="Delete" 
          onClick={() => {
            if (window.confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
              // Send message to background script to delete recording
              chrome.runtime.sendMessage(
                { action: 'deleteRecording', recordingId: meetingData.id },
                (response) => {
                  if (response && response.success) {
                    alert('Recording deleted successfully');
                    window.close(); // Close the window after deletion
                  } else {
                    alert('Failed to delete recording: ' + (response?.error || 'Unknown error'));
                  }
                }
              );
            }
          }}
          className="p-2 rounded-full hover:bg-red-50 text-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          <Trash2 size={20}/>
        </button>
        <div className="relative">
          <button 
            title="More Options" 
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <MoreVertical size={20}/>
          </button>
          
          {showMoreOptions && (
            <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-30">
              <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                <button
                  className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => {
                    // Export as JSON
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(meetingData, null, 2));
                    const downloadAnchorNode = document.createElement('a');
                    downloadAnchorNode.setAttribute("href", dataStr);
                    downloadAnchorNode.setAttribute("download", `${meetingData.title.replace(/\s+/g, '_')}.json`);
                    document.body.appendChild(downloadAnchorNode);
                    downloadAnchorNode.click();
                    downloadAnchorNode.remove();
                    setShowMoreOptions(false);
                  }}
                >
                  Export as JSON
                </button>
                <button
                  className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  role="menuitem"
                  onClick={() => {
                    // Generate a summary email
                    const subject = `Meeting Summary: ${meetingData.title}`;
                    const decisions = meetingData.meetingMemoryMoments
                      .filter(m => m.type === 'decision')
                      .map(m => `- ${m.text}`)
                      .join('\n');
                    const actions = meetingData.meetingMemoryMoments
                      .filter(m => m.type === 'action')
                      .map(m => `- ${m.text}`)
                      .join('\n');
                    
                    const body = `
Summary of ${meetingData.title}
Date: ${new Date(meetingData.date).toLocaleDateString()}
Duration: ${Math.floor(meetingData.duration / 60)} minutes

Key Decisions:
${decisions || 'None recorded'}

Action Items:
${actions || 'None recorded'}

This summary was generated by Meeting Memory.
`;
                    
                    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    window.open(mailtoLink);
                    setShowMoreOptions(false);
                  }}
                >
                  Send Summary Email
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );

  // --- Material-Inspired Tabs --- (Subtle indicator)
  const renderTabs = () => (
    <nav className="bg-white border-b border-gray-200 sticky top-[60px] z-20"> {/* Adjust top based on header height */} 
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-start space-x-6">
          <button
            onClick={() => handleTabChange('timeline')}
            className={`py-3 px-1 border-b-2 text-sm transition-colors duration-150 ease-in-out focus:outline-none 
              ${currentTab === 'timeline' 
                ? 'border-blue-600 text-blue-600 font-semibold' // Bolder active state 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium'}`}
          >
            TIMELINE
          </button>
          <button
            onClick={() => handleTabChange('transcript')}
            className={`py-3 px-1 border-b-2 text-sm transition-colors duration-150 ease-in-out focus:outline-none 
              ${currentTab === 'transcript' 
                ? 'border-blue-600 text-blue-600 font-semibold' // Bolder active state
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium'}`}
          >
            TRANSCRIPT
          </button>
          <button 
            onClick={() => handleTabChange('summary')}
            className={`py-3 px-1 border-b-2 text-sm transition-colors duration-150 ease-in-out focus:outline-none 
              ${currentTab === 'summary' 
                ? 'border-blue-600 text-blue-600 font-semibold' // Bolder active state
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium'}`}
          >
            SUMMARY
          </button>
          <button 
            onClick={() => handleTabChange('aiinsights')}
            className={`py-3 px-1 border-b-2 text-sm transition-colors duration-150 ease-in-out focus:outline-none 
              ${currentTab === 'aiinsights' 
                ? 'border-blue-600 text-blue-600 font-semibold' // Bolder active state
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium'}`}
          >
            AI INSIGHTS
          </button>
        </div>
      </div>
    </nav>
  );

  // Find the currently selected moment object from the meetingData
  const currentSelectedMomentData = selectedMoment 
    ? meetingData?.meetingMemoryMoments?.find(m => m.id === selectedMoment)
    : null;

  return (
    // Main container with adjusted background 
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans"> {/* Use common Material/system font */} 
      {renderHeader()}
      {renderTabs()}
      
      {/* Audio Element (hidden) */}
      <audio 
        ref={audioRef}
        src={audioSrc}
        onLoadedMetadata={handleAudioLoaded}
        onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
        onEnded={handleAudioEnded}
        preload="metadata"
        className="hidden"
      />
      
      {/* Main content area with padding */}
      <main className="flex-grow p-4 md:p-6 overflow-y-auto">
        {currentTab === 'timeline' && (
          <div style={{ display: currentTab === 'timeline' ? 'block' : 'none' }}>
            {/* Audio Waveform Display */}
            {audioSrc && (
              <div className="mb-4 bg-white p-4 rounded-lg shadow border border-gray-200">
                <h4 className="text-base font-medium text-gray-700 mb-2">Audio Waveform</h4>
                <AudioWaveform 
                  audioUrl={audioSrc}
                  currentTime={currentTime}
                  duration={audioDuration || meetingData?.duration || 0}
                  onSeek={handleSeek}
                  isPlaying={isPlaying}
                />
              </div>
            )}
            
            {/* Data Visualization Panel */}
            <DataVisualizationPanel 
              meetingData={meetingData}
              currentTime={currentTime}
              onSeek={handleSeek}
              onSpeakerFilter={(speaker) => {
                // Set search query to filter by speaker
                setTimelineSearch(speaker);
              }}
              onTopicFilter={(topic) => {
                // Set search query to filter by topic
                setTimelineSearch(topic);
              }}
            />
            
            <TimelineVisualization 
              currentTime={currentTime} 
              duration={audioDuration || meetingData?.duration || 0}
              onSeek={handleSeek}
              meetingData={meetingData}
            />

            <SearchAndFilterControls
              timelineSearch={timelineSearch}
              onSearchChange={(e) => setTimelineSearch(e.target.value)}
              activeFilters={activeFilters} 
              onFilterChange={handleFilterChange}
            />

            {/* Timeline Entries Container - Add Material card-like styling later */}
            <div className="mt-6 bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              {/* Timeline header - Refined style */} 
              <div className="flex border-b border-gray-200 py-2 px-4 bg-gray-50 sticky top-[108px] z-10"> {/* Adjust top based on header+tabs */} 
                <div className="w-1/6 text-xs font-medium text-gray-500 uppercase tracking-wider">Time</div>
                <div className="w-1/6 text-xs font-medium text-gray-500 uppercase tracking-wider">Speaker</div>
                <div className="w-1/2 text-xs font-medium text-gray-500 uppercase tracking-wider">Content</div>
                <div className="w-1/6 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</div>
              </div>

              {/* Timeline entries list */}
              <div className="relative">
                {(meetingData?.meetingMemoryMoments || [])
                  // Sort entries chronologically if not already
                  .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
                  .map((moment) => (
                    <TimelineEntry 
                      key={moment.id} 
                      moment={moment} 
                      isSelected={selectedMoment === moment.id}
                      onSelect={handleMomentSelect}
                      searchQuery={timelineSearch}
                      onSeek={handleSeek} // Pass the seek function to enable timestamp navigation
                    />
                  ))}
                {(meetingData?.meetingMemoryMoments || []).length === 0 && (
                  <div className="p-6 text-center text-gray-500 text-sm">No timeline moments found.</div>
                )} 
              </div>
            </div>

            {/* Details Panel - will style later */}
            <MomentDetailsPanel
              moment={currentSelectedMomentData}
              commentInput={commentInput}
              onCommentInputChange={(e) => setCommentInput(e.target.value)}
              onAddComment={handleAddComment}
              onClose={() => setSelectedMoment(null)} 
              onPlaySegment={(timestamp) => {
                // Set current time to the timestamp and start playing
                handleSeek(timestamp);
                setIsPlaying(true);
                // If you have an actual audio element:
                // if (audioRef.current) {
                //   audioRef.current.play();
                // }
                console.log("Playing segment starting at:", timestamp);
              }}
            />
          </div>
        )}
        {currentTab === 'transcript' && (
          <div style={{ display: currentTab === 'transcript' ? 'block' : 'none' }} className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-medium text-gray-800 mb-4">Full Transcript</h2>
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {(meetingData?.transcript || []).length > 0 ? (
                meetingData.transcript.map((entry, index) => (
                  <div key={index} className="mb-4 p-3 hover:bg-gray-50 border-b border-gray-100">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-blue-600">{entry.speaker}</span>
                      <span className="text-sm text-gray-500">{formatTime(entry.timestamp)}</span>
                    </div>
                    <p className="text-gray-800">{entry.text}</p>
                    <button 
                      className="text-xs text-blue-600 mt-1 hover:underline"
                      onClick={() => handleSeek(entry.timestamp)}
                    >
                      Jump to this moment
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">No transcript available for this recording.</p>
              )}
            </div>
          </div>
        )}
        {currentTab === 'summary' && (
          <div style={{ display: currentTab === 'summary' ? 'block' : 'none' }} className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-medium text-gray-800 mb-4">Meeting Summary</h2>
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Overview</h3>
              <p className="text-gray-800">{meetingData?.summary || "No summary available for this recording."}</p>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Key Decisions</h3>
              {(meetingData?.meetingMemoryMoments || []).filter(m => m.type === 'decision').length > 0 ? (
                <ul className="list-disc pl-5 space-y-2">
                  {meetingData.meetingMemoryMoments
                    .filter(m => m.type === 'decision')
                    .map((decision) => (
                      <li key={decision.id} className="text-gray-800">
                        <span>{decision.text}</span>
                        <button 
                          className="text-xs text-blue-600 ml-2 hover:underline"
                          onClick={() => handleSeek(decision.timestamp)}
                        >
                          ({formatTime(decision.timestamp)})
                        </button>
                      </li>
                    ))
                  }
                </ul>
              ) : (
                <p className="text-gray-500 italic">No decisions recorded in this meeting.</p>
              )}
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-2">Action Items</h3>
              {(meetingData?.meetingMemoryMoments || []).filter(m => m.type === 'action').length > 0 ? (
                <ul className="list-disc pl-5 space-y-2">
                  {meetingData.meetingMemoryMoments
                    .filter(m => m.type === 'action')
                    .map((action) => (
                      <li key={action.id} className="text-gray-800">
                        <span>{action.text}</span>
                        <span className="text-sm text-gray-500 ml-2">({action.speaker})</span>
                        <button 
                          className="text-xs text-blue-600 ml-2 hover:underline"
                          onClick={() => handleSeek(action.timestamp)}
                        >
                          ({formatTime(action.timestamp)})
                        </button>
                      </li>
                    ))
                  }
                </ul>
              ) : (
                <p className="text-gray-500 italic">No action items recorded in this meeting.</p>
              )}
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">Topics Covered</h3>
              {(meetingData?.topics || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {meetingData.topics.map((topic, index) => (
                    <div 
                      key={index}
                      className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-200"
                      onClick={() => handleSeek(topic.start)}
                    >
                      {topic.title} ({formatTime(topic.start)} - {formatTime(topic.end)})
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No topics detected for this meeting.</p>
              )}
            </div>
          </div>
        )}
        {currentTab === 'aiinsights' && !window.getAIInsightsData && (
          <div style={{ display: currentTab === 'aiinsights' ? 'block' : 'none' }}>
            <AIInsightsPanel
              meetingData={meetingData}
              onSeek={handleSeek}
              onMomentSelect={handleMomentSelect}
            />
          </div>
        )}
      </main>

      {/* Media Player Controls Footer */}
      <footer className="bg-white border-t border-gray-200 p-3 flex items-center justify-between">
        {/* Left Section: Playback Controls */}
        <div className="flex items-center space-x-3">
          {/* Play/Pause Button */}
          <button 
            onClick={handlePlayPause}
            disabled={!isAudioLoaded}
            className={`p-2 rounded-full ${isAudioLoaded ? 'hover:bg-gray-100 text-gray-800' : 'text-gray-400 cursor-not-allowed'} focus:outline-none`}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          
          {/* Time display */}
          <div className="text-sm text-gray-600">
            <span>{formatTime(currentTime)}</span>
            <span className="mx-1">/</span>
            <span>{formatTime(audioDuration || meetingData?.duration || 0)}</span>
          </div>
        </div>
        
        {/* Center: Position Slider */}
        <div className="flex-grow mx-4">
          <input 
            type="range" 
            min="0" 
            max={audioDuration || meetingData?.duration || 0} 
            value={currentTime}
            step="0.1"
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            disabled={!isAudioLoaded}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${isAudioLoaded ? 'bg-gray-200' : 'bg-gray-100'}`}
            style={{
              backgroundImage: isAudioLoaded ? `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${(currentTime / (audioDuration || meetingData?.duration || 1)) * 100}%, #E5E7EB ${(currentTime / (audioDuration || meetingData?.duration || 1)) * 100}%, #E5E7EB 100%)` : '',
              height: '4px'
            }}
          />
        </div>
        
        {/* Right Section: Speed Control */}
        <div className="flex items-center">
          <div className="relative group">
            <button 
              className="text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded focus:outline-none"
              disabled={!isAudioLoaded}
            >
              {playbackSpeed}x
            </button>
            
            <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block bg-white shadow-lg rounded-md border border-gray-200 p-1 z-10">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((speed) => (
                <button 
                  key={speed} 
                  onClick={() => handleSpeedChange(speed)}
                  className={`block w-full text-left px-3 py-1 text-sm rounded ${playbackSpeed === speed ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RecordingDetails; 