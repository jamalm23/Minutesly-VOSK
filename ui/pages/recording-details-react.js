// Recording Details React Component
// Adapted from recording_details_claude.jsx for Chrome Extension context

// Initialize Lucide icons
const { 
  ArrowLeft, Play, Pause, Download, Share2, Trash2, MoreVertical, MessageSquare, Clock, 
  AlertCircle, ChevronDown, Search, Edit3
} = lucide;

// Root element to render React component
const rootElement = document.getElementById('root');

// Main Recording Details Component
const RecordingDetails = () => {
  // State management
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTab, setCurrentTab] = React.useState('transcript');
  const [currentTime, setCurrentTime] = React.useState(0);
  const [showInsights, setShowInsights] = React.useState(false);
  
  // Recording data state
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [recordingData, setRecordingData] = React.useState(null);
  const [audioUrl, setAudioUrl] = React.useState(null);
  
  // Audio player ref
  const audioRef = React.useRef(null);
  
  // Get recording ID from URL
  const getRecordingId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
  };
  
  // Load recording data
  React.useEffect(() => {
    const recordingId = getRecordingId();
    
    if (!recordingId) {
      setError('No recording ID provided in URL');
      setLoading(false);
      return;
    }
    
    // Fetch recording data from Chrome extension
    chrome.runtime.sendMessage({ action: 'getRecordingById', id: recordingId }, (response) => {
      if (chrome.runtime.lastError) {
        setError(`Error fetching recording: ${chrome.runtime.lastError.message}`);
        setLoading(false);
        return;
      }
      
      if (!response?.success) {
        setError(`Failed to load recording: ${response?.error || 'Unknown error'}`);
        setLoading(false);
        return;
      }
      
      setRecordingData(response.recording);
      setLoading(false);
      
      // Load audio data
      loadAudio(recordingId);
    });
  }, []);
  
  // Load audio data
  const loadAudio = (recordingId) => {
    chrome.runtime.sendMessage({ action: 'getRecordingBlob', id: recordingId }, (response) => {
      if (chrome.runtime.lastError || !response?.success || !response.dataUrl) {
        console.error("Error fetching audio:", chrome.runtime.lastError?.message || response?.error);
        return;
      }
      
      setAudioUrl(response.dataUrl);
    });
  };
  
  // Handle audio playback
  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play()
        .catch(err => console.error('Playback error:', err));
    }
    
    setIsPlaying(!isPlaying);
  };
  
  // Update current time on audio timeupdate
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };
  
  // Navigate back to dashboard
  const navigateBack = () => {
    window.location.href = 'dashboard.html';
  };
  
  // Delete recording
  const deleteRecording = () => {
    if (!recordingData || !recordingData.id) return;
    
    if (window.confirm(`Are you sure you want to permanently delete this recording?`)) {
      chrome.runtime.sendMessage({ action: 'deleteRecording', id: recordingData.id }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          alert(`Failed to delete recording: ${response?.error || 'Unknown error'}`);
          return;
        }
        
        alert('Recording deleted successfully');
        navigateBack();
      });
    }
  };
  
  // Download recording
  const downloadRecordingFile = () => {
    if (!recordingData || !recordingData.id) return;
    
    chrome.runtime.sendMessage({ action: 'downloadRecording', id: recordingData.id }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        alert(`Failed to download recording: ${response?.error || 'Unknown error'}`);
      }
    });
  };
  
  // Format metadata values
  const formatMetadata = () => {
    if (!recordingData) return {};
    
    const metadata = recordingData.metadata || {};
    const analysis = recordingData.analysis || {};
    
    return {
      filename: metadata.filename || `recording-${recordingData.id}.webm`,
      timestamp: metadata.timestamp ? new Date(metadata.timestamp).toLocaleString() : 'Unknown',
      duration: metadata.duration ? window.formatDuration(metadata.duration) : '00:00',
      fileSize: metadata.fileSize ? window.formatFileSize(metadata.fileSize) : '0 KB',
      status: metadata.transcriptionStatus || 'Not Transcribed',
      summaryStatus: analysis.summaryStatus || 'Not Generated',
      language: metadata.detectedLanguage || 'N/A',
      speakers: metadata.speakerCount || 'N/A',
      importance: analysis.importance || 'N/A',
      sentiment: analysis.sentiment || 'Neutral',
      actions: analysis.actionItemsCount || 0,
      followUp: analysis.followUpRequired ? 'Yes' : 'No',
      topics: analysis.topics || [],
      keywords: analysis.keywords || []
    };
  };
  
  // Render loading state
  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 items-center justify-center">
        <div className="text-center p-8">
          <div className="mb-4">
            <span className="material-symbols-outlined text-5xl text-gray-400">hourglass_top</span>
          </div>
          <h2 className="text-xl font-medium mb-2">Loading Recording Details...</h2>
          <p className="text-gray-500">Please wait while we fetch the recording information.</p>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 items-center justify-center">
        <div className="text-center p-8 max-w-lg">
          <div className="mb-4">
            <span className="material-symbols-outlined text-5xl text-red-500">error</span>
          </div>
          <h2 className="text-xl font-medium mb-2">Error Loading Recording</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={navigateBack}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  // Get formatted metadata
  const meta = formatMetadata();
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Hidden audio element */}
      <audio 
        ref={audioRef}
        src={audioUrl} 
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />
      
      {/* Header */}
      <header className="bg-white p-4 shadow flex items-center">
        <button className="text-blue-500 mr-4" onClick={navigateBack}>
          <ArrowLeft />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-medium">{meta.filename}</h1>
          <p className="text-sm text-gray-500">{meta.timestamp} • {meta.duration} • {meta.fileSize}</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" onClick={downloadRecordingFile}>
            <Download size={20} />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Share2 size={20} />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" onClick={deleteRecording}>
            <Trash2 size={20} />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Player section */}
      <div className="bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center mb-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-2">
            <button 
              className="w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </button>
          </div>
          <div className="text-sm text-gray-500">Audio Recording Player</div>
        </div>
        
        {/* Audio timeline */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>{currentTime ? window.formatDuration(currentTime * 1000) : '00:00'}</span>
          <span>{meta.duration}</span>
        </div>
      </div>

      {/* Meeting details with collapsible insights */}
      <div className="bg-white mt-4 shadow-sm">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-medium">Meeting Details</h3>
          <button 
            className="text-blue-500 text-sm flex items-center gap-1"
            onClick={() => setShowInsights(!showInsights)}
          >
            {showInsights ? 'Hide Insights' : 'Show Insights'}
            <span className={`transform transition-transform ${showInsights ? 'rotate-180' : ''}`}>
              <ChevronDown size={16} />
            </span>
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 p-4 border-b">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <div className="flex items-center gap-1 mt-1">
              <AlertCircle size={16} className="text-orange-500" />
              <span className="text-sm">{meta.status}</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Summary</p>
            <div className="flex items-center gap-1 mt-1">
              <AlertCircle size={16} className="text-orange-500" />
              <span className="text-sm">{meta.summaryStatus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white mt-4 shadow-sm flex-1 flex flex-col">
        <div className="border-b flex">
          <button 
            className={`px-6 py-3 text-sm font-medium border-b-2 ${currentTab === 'transcript' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}
            onClick={() => setCurrentTab('transcript')}
          >
            Transcript
          </button>
          <button 
            className={`px-6 py-3 text-sm font-medium border-b-2 ${currentTab === 'timeline' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}
            onClick={() => setCurrentTab('timeline')}
          >
            Timeline
          </button>
          <button 
            className={`px-6 py-3 text-sm font-medium border-b-2 ${currentTab === 'summary' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}
            onClick={() => setCurrentTab('summary')}
          >
            Summary
          </button>
        </div>
        
        {/* Tab content */}
        <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
          {currentTab === 'transcript' && (
            <div className="w-full max-w-4xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={24} className="text-blue-500" />
                </div>
                <h3 className="text-lg font-medium mb-2">No Transcript Available</h3>
                <p className="text-gray-500 mb-6">This recording hasn't been transcribed yet. Click below to generate a transcript.</p>
                <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium">
                  Generate Transcript
                </button>
              </div>
            </div>
          )}
          
          {currentTab === 'timeline' && (
            <div className="text-center">
              <Clock size={48} className="text-blue-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Timeline Available</h3>
              <p className="text-gray-500 mb-2">Generate a transcript first to access the timeline.</p>
            </div>
          )}
          
          {currentTab === 'summary' && (
            <div className="text-center">
              <MessageSquare size={48} className="text-blue-300 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Summary Available</h3>
              <p className="text-gray-500 mb-2">Generate a transcript first to create a summary.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Render the React component
ReactDOM.createRoot(rootElement).render(<RecordingDetails />);
