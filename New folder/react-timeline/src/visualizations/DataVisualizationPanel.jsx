import React, { useState } from 'react';
import TopicDistributionChart from './TopicDistributionChart';
import SentimentTimeline from './SentimentTimeline';
import SpeakerContributionChart from './SpeakerContributionChart';

/**
 * Data Visualization Panel Component
 * Coordinates and displays the various data visualization components
 * 
 * @param {Object} props - Component props
 * @param {Object} props.meetingData - Object containing meeting data
 * @param {number} props.currentTime - Current playback position in seconds
 * @param {Function} props.onSeek - Callback for seeking to a specific timestamp
 * @param {Function} props.onSpeakerFilter - Callback for filtering by speaker
 * @param {Function} props.onTopicFilter - Callback for filtering by topic
 */
const DataVisualizationPanel = ({ 
  meetingData = {}, 
  currentTime = 0, 
  onSeek,
  onSpeakerFilter,
  onTopicFilter
}) => {
  const [activeSection, setActiveSection] = useState('all'); // 'all', 'topics', 'sentiment', 'speakers'
  
  // Extract necessary data for the visualizations
  const topics = meetingData?.topics || [];
  const sentimentData = meetingData?.sentimentData || [];
  const moments = meetingData?.meetingMemoryMoments || [];
  const duration = meetingData?.duration || 0;
  
  // Handle navigation to specific timestamp
  const handleSeek = (timestamp) => {
    if (onSeek && typeof timestamp === 'number') {
      onSeek(timestamp);
    }
  };
  
  // Handle speaker filter
  const handleSpeakerClick = (speakerName) => {
    if (onSpeakerFilter && speakerName) {
      onSpeakerFilter(speakerName);
    }
  };
  
  // Handle topic filter
  const handleTopicClick = (topic) => {
    if (onTopicFilter && topic) {
      // Seek to the start of the topic
      if (onSeek && typeof topic.start === 'number') {
        onSeek(topic.start);
      }
      
      // Apply topic filter
      onTopicFilter(topic.title);
    }
  };
  
  // Determine if we should show the visualizations based on data availability
  const hasTopicData = topics.length > 0;
  const hasSentimentData = sentimentData.length > 0;
  const hasSpeakerData = moments.some(m => m.speaker);
  const hasAnyData = hasTopicData || hasSentimentData || hasSpeakerData;
  
  // If no data available, show a message
  if (!hasAnyData) {
    return (
      <div className="bg-white rounded-lg shadow p-6 my-6">
        <h2 className="text-xl font-medium text-gray-800 mb-4">Meeting Insights</h2>
        <div className="h-40 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">No analytics data available for this meeting</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6 my-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-medium text-gray-800">Meeting Insights</h2>
        
        {/* Section selector */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-md">
          <button 
            className={`text-sm py-1 px-3 rounded ${activeSection === 'all' ? 'bg-white shadow text-blue-600' : 'text-gray-700'}`}
            onClick={() => setActiveSection('all')}
          >
            All
          </button>
          {hasTopicData && (
            <button 
              className={`text-sm py-1 px-3 rounded ${activeSection === 'topics' ? 'bg-white shadow text-blue-600' : 'text-gray-700'}`}
              onClick={() => setActiveSection('topics')}
            >
              Topics
            </button>
          )}
          {hasSentimentData && (
            <button 
              className={`text-sm py-1 px-3 rounded ${activeSection === 'sentiment' ? 'bg-white shadow text-blue-600' : 'text-gray-700'}`}
              onClick={() => setActiveSection('sentiment')}
            >
              Sentiment
            </button>
          )}
          {hasSpeakerData && (
            <button 
              className={`text-sm py-1 px-3 rounded ${activeSection === 'speakers' ? 'bg-white shadow text-blue-600' : 'text-gray-700'}`}
              onClick={() => setActiveSection('speakers')}
            >
              Speakers
            </button>
          )}
        </div>
      </div>
      
      {/* Visualization grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Topic Distribution Chart */}
        {(activeSection === 'all' || activeSection === 'topics') && hasTopicData && (
          <div className={`${activeSection === 'topics' ? 'md:col-span-2' : ''}`}>
            <TopicDistributionChart 
              topics={topics} 
              totalDuration={duration} 
              onTopicClick={handleTopicClick} 
            />
          </div>
        )}
        
        {/* Sentiment Timeline */}
        {(activeSection === 'all' || activeSection === 'sentiment') && hasSentimentData && (
          <div className={`${activeSection === 'sentiment' ? 'md:col-span-2' : ''}`}>
            <SentimentTimeline 
              sentimentData={sentimentData} 
              duration={duration} 
              currentTime={currentTime}
              onPointClick={handleSeek}
            />
          </div>
        )}
        
        {/* Speaker Contribution Analysis */}
        {(activeSection === 'all' || activeSection === 'speakers') && hasSpeakerData && (
          <div className={`${activeSection === 'speakers' ? 'md:col-span-2' : ''}`}>
            <SpeakerContributionChart 
              moments={moments} 
              duration={duration} 
              onSpeakerClick={handleSpeakerClick}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DataVisualizationPanel; 