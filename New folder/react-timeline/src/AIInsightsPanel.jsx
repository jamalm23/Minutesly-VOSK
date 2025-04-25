import React, { useState } from 'react';
import {
  MessageSquare, 
  Tag, 
  BarChart2, 
  CheckSquare, 
  Star,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

/**
 * AI Insights Panel Component
 * Displays AI-powered features and their results
 * 
 * @param {Object} props - Component props
 * @param {Object} props.meetingData - Meeting data including transcript, topics, and moments
 * @param {Function} props.onSeek - Function to seek to a specific timestamp
 * @param {Function} props.onMomentSelect - Function to select a specific moment
 */
const AIInsightsPanel = ({ meetingData, onSeek, onMomentSelect }) => {
  const [expandedSection, setExpandedSection] = useState('transcription');

  // Helper function to format time
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Extract action items from meeting moments
  const actionItems = (meetingData?.meetingMemoryMoments || [])
    .filter(moment => moment.type === 'action')
    .sort((a, b) => a.timestamp - b.timestamp);

  // Extract key moments (decisions and important questions)
  const keyMoments = (meetingData?.meetingMemoryMoments || [])
    .filter(moment => moment.type === 'decision' || moment.type === 'objection')
    .sort((a, b) => a.timestamp - b.timestamp);

  // Get topics for highlighting
  const topics = meetingData?.topics || [];

  // Get transcript lines
  const transcript = meetingData?.transcript || [];

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">AI-Powered Insights</h2>
      <p className="text-sm text-gray-600 mb-4">
        Automatically extracted insights from your meeting audio.
      </p>

      {/* Automated Transcription Section */}
      <div className="mb-4 border-b border-gray-200 pb-4">
        <button 
          className="flex items-center justify-between w-full text-left"
          onClick={() => toggleSection('transcription')}
        >
          <div className="flex items-center">
            <MessageSquare className="text-blue-500 mr-2" size={20} />
            <span className="font-medium">Automated Transcription</span>
          </div>
          {expandedSection === 'transcription' ? 
            <ChevronDown size={20} /> : 
            <ChevronRight size={20} />
          }
        </button>
        
        {expandedSection === 'transcription' && (
          <div className="mt-3 pl-7">
            <p className="text-sm text-gray-600 mb-2">
              Speech-to-text conversion with speaker identification.
            </p>
            <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-md p-3 text-sm">
              {transcript.length > 0 ? (
                transcript.map((line, index) => (
                  <div 
                    key={index} 
                    className="mb-2 cursor-pointer hover:bg-gray-100 p-1 rounded"
                    onClick={() => onSeek(line.timestamp)}
                  >
                    <span className="text-gray-500 font-medium mr-2">[{formatTime(line.timestamp)}]</span>
                    <span className="text-blue-600 font-medium mr-1">{line.speaker}:</span>
                    <span>{line.text}</span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">Transcript not available for this recording.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Topic Detection Section */}
      <div className="mb-4 border-b border-gray-200 pb-4">
        <button 
          className="flex items-center justify-between w-full text-left"
          onClick={() => toggleSection('topics')}
        >
          <div className="flex items-center">
            <Tag className="text-green-500 mr-2" size={20} />
            <span className="font-medium">Topic Detection</span>
          </div>
          {expandedSection === 'topics' ? 
            <ChevronDown size={20} /> : 
            <ChevronRight size={20} />
          }
        </button>
        
        {expandedSection === 'topics' && (
          <div className="mt-3 pl-7">
            <p className="text-sm text-gray-600 mb-2">
              Automatic identification of discussion topics.
            </p>
            <div className="bg-gray-50 rounded-md p-3">
              {topics.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic, index) => (
                    <div 
                      key={index}
                      className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-green-200"
                      onClick={() => onSeek(topic.start)}
                    >
                      {topic.title} ({formatTime(topic.start)} - {formatTime(topic.end)})
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">No topics detected.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sentiment Analysis Section */}
      <div className="mb-4 border-b border-gray-200 pb-4">
        <button 
          className="flex items-center justify-between w-full text-left"
          onClick={() => toggleSection('sentiment')}
        >
          <div className="flex items-center">
            <BarChart2 className="text-purple-500 mr-2" size={20} />
            <span className="font-medium">Sentiment Analysis</span>
          </div>
          {expandedSection === 'sentiment' ? 
            <ChevronDown size={20} /> : 
            <ChevronRight size={20} />
          }
        </button>
        
        {expandedSection === 'sentiment' && (
          <div className="mt-3 pl-7">
            <p className="text-sm text-gray-600 mb-2">
              Emotional tone detection throughout the meeting.
            </p>
            <div className="bg-gray-50 rounded-md p-3">
              {meetingData?.sentimentData?.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs mb-1">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-1"></div>
                      <span>Negative</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mr-1"></div>
                      <span>Neutral</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-1"></div>
                      <span>Positive</span>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                    <div className="flex h-full">
                      {meetingData.sentimentData.map((point, index) => {
                        // Define color based on sentiment value
                        let bgColor = 'bg-yellow-500'; // neutral
                        if (point.value >= 0.7) bgColor = 'bg-green-500'; // positive
                        if (point.value <= 0.3) bgColor = 'bg-red-500'; // negative
                        
                        // Calculate width percentage and position
                        const segmentWidth = index === meetingData.sentimentData.length - 1 
                          ? 100 - (index * (100 / meetingData.sentimentData.length))
                          : 100 / meetingData.sentimentData.length;
                        
                        return (
                          <div 
                            key={index}
                            className={`${bgColor} cursor-pointer`}
                            style={{ width: `${segmentWidth}%` }}
                            onClick={() => onSeek(point.position * meetingData.duration)}
                            title={`Sentiment: ${Math.round(point.value * 100)}% at ${formatTime(point.position * meetingData.duration)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-center mt-1 text-gray-500">Click on segments to navigate to that point</p>
                </div>
              ) : (
                <p className="text-gray-500 italic">No sentiment data available.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Item Identification Section */}
      <div className="mb-4 border-b border-gray-200 pb-4">
        <button 
          className="flex items-center justify-between w-full text-left"
          onClick={() => toggleSection('actions')}
        >
          <div className="flex items-center">
            <CheckSquare className="text-amber-500 mr-2" size={20} />
            <span className="font-medium">Action Item Identification</span>
          </div>
          {expandedSection === 'actions' ? 
            <ChevronDown size={20} /> : 
            <ChevronRight size={20} />
          }
        </button>
        
        {expandedSection === 'actions' && (
          <div className="mt-3 pl-7">
            <p className="text-sm text-gray-600 mb-2">
              Automatic flagging of tasks and follow-ups.
            </p>
            <div className="bg-gray-50 rounded-md p-3">
              {actionItems.length > 0 ? (
                <ul className="list-disc list-inside">
                  {actionItems.map((item) => (
                    <li 
                      key={item.id}
                      className="mb-2 cursor-pointer hover:text-blue-600"
                      onClick={() => onMomentSelect(item.id)}
                    >
                      <span className="text-gray-500 mr-2">[{formatTime(item.timestamp)}]</span>
                      <span>{item.text}</span>
                      <span className="text-gray-500 ml-1">({item.speaker})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">No action items detected.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Key Moment Detection Section */}
      <div className="mb-2">
        <button 
          className="flex items-center justify-between w-full text-left"
          onClick={() => toggleSection('keyMoments')}
        >
          <div className="flex items-center">
            <Star className="text-orange-500 mr-2" size={20} />
            <span className="font-medium">Key Moment Detection</span>
          </div>
          {expandedSection === 'keyMoments' ? 
            <ChevronDown size={20} /> : 
            <ChevronRight size={20} />
          }
        </button>
        
        {expandedSection === 'keyMoments' && (
          <div className="mt-3 pl-7">
            <p className="text-sm text-gray-600 mb-2">
              Identification of important meeting segments.
            </p>
            <div className="bg-gray-50 rounded-md p-3">
              {keyMoments.length > 0 ? (
                <ul className="list-disc list-inside">
                  {keyMoments.map((moment) => (
                    <li 
                      key={moment.id}
                      className="mb-2 cursor-pointer hover:text-blue-600"
                      onClick={() => onMomentSelect(moment.id)}
                    >
                      <span className="text-gray-500 mr-2">[{formatTime(moment.timestamp)}]</span>
                      <span className="text-xs font-medium uppercase px-1.5 py-0.5 rounded mr-1 inline-block" 
                        style={{
                          backgroundColor: moment.type === 'decision' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: moment.type === 'decision' ? 'rgb(21, 128, 61)' : 'rgb(185, 28, 28)'
                        }}
                      >
                        {moment.type}
                      </span>
                      <span>{moment.text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">No key moments detected.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsightsPanel; 