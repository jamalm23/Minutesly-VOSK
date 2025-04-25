import React, { useState } from 'react';
import { HelpCircle, AlertCircle, CheckCircle, MessageCircle, Star, ThumbsUp, ThumbsDown } from 'lucide-react';

// Helper function to format time (e.g., seconds to MM:SS)
const formatTime = (totalSeconds) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const TimelineVisualization = ({ 
  currentTime, 
  duration, 
  onSeek,
  meetingData // Add this prop to access all meeting data
}) => {
  const [showLegend, setShowLegend] = useState(false);
  const [hoveredMoment, setHoveredMoment] = useState(null);
  
  if (!duration || duration <= 0) {
    return null; // Don't render if duration is invalid
  }

  const handleTimelineClick = (event) => {
    const timeline = event.currentTarget; // The div the handler is attached to
    const rect = timeline.getBoundingClientRect();
    const clickX = event.clientX - rect.left; // Get X coordinate relative to the timeline element
    const timelineWidth = rect.width;
    
    const clickRatio = Math.max(0, Math.min(1, clickX / timelineWidth));
    const seekTime = clickRatio * duration;
    
    console.log(`Timeline clicked: ratio=${clickRatio}, seekTime=${seekTime}`);
    onSeek(seekTime); // Call the parent's seek handler
  };

  // --- Process Meeting Data For Visualization ---
  // For topic segments, use actual topics if available, otherwise use mock data
  const segments = meetingData?.topics || [
    { start: 0, end: duration * 0.25, title: 'Introduction', colorFrom: 'from-blue-100', colorTo: 'to-blue-200', textColor: 'text-blue-700' },
    { start: duration * 0.25, end: duration * 0.6, title: 'Core Discussion', colorFrom: 'from-green-100', colorTo: 'to-green-200', textColor: 'text-green-700' },
    { start: duration * 0.6, end: duration * 0.85, title: 'Q&A', colorFrom: 'from-yellow-100', colorTo: 'to-yellow-200', textColor: 'text-yellow-700' },
    { start: duration * 0.85, end: duration, title: 'Wrap Up', colorFrom: 'from-purple-100', colorTo: 'to-purple-200', textColor: 'text-purple-700' },
  ];

  // Extract key moments from meeting data
  const moments = meetingData?.meetingMemoryMoments || [];

  // Define moment type styles and icons
  const momentStyles = {
    question: { 
      icon: MessageCircle, 
      bgColor: 'bg-purple-400',
      borderColor: 'border-purple-500',
      label: 'Question'
    },
    decision: { 
      icon: CheckCircle, 
      bgColor: 'bg-green-400',
      borderColor: 'border-green-500',
      label: 'Decision'
    },
    action: { 
      icon: Star, 
      bgColor: 'bg-yellow-400',
      borderColor: 'border-yellow-500',
      label: 'Action Item'
    },
    objection: { 
      icon: AlertCircle, 
      bgColor: 'bg-red-400',
      borderColor: 'border-red-500',
      label: 'Objection'
    },
    feedback_positive: { 
      icon: ThumbsUp, 
      bgColor: 'bg-blue-400',
      borderColor: 'border-blue-500',
      label: 'Positive Feedback'
    },
    feedback_negative: { 
      icon: ThumbsDown, 
      bgColor: 'bg-gray-400',
      borderColor: 'border-gray-500',
      label: 'Negative Feedback'
    }
  };

  // Generate sentiment data points if available from meetingData
  // If not available, create placeholder mockup
  const sentimentData = meetingData?.sentimentData || Array(10).fill(0).map((_, i) => ({
    position: i / 9,  // 0 to 1 position along timeline
    value: Math.sin(i) * 0.5 + 0.5,  // Mock sine wave between 0-1
    // In a real implementation, this would be a value from 0 to 1 where 0 is negative and 1 is positive
  }));

  // Calculate playhead position
  const playheadPositionPercent = (currentTime / duration) * 100;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-base font-medium text-gray-700">Meeting Timeline</h4>
        
        {/* Legend Button */}
        <button 
          className="flex items-center text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors"
          onClick={() => setShowLegend(!showLegend)}
        >
          <HelpCircle size={14} className="mr-1" /> {showLegend ? 'Hide Legend' : 'Show Legend'}
        </button>
      </div>
      
      {/* Legend Panel */}
      {showLegend && (
        <div className="bg-white border border-gray-200 rounded-md shadow-sm p-3 mb-3 text-xs text-gray-700 grid grid-cols-2 md:grid-cols-3 gap-2">
          <div className="col-span-2 md:col-span-3 font-medium mb-1">Timeline Legend:</div>
          
          {/* Topic Legend */}
          <div className="flex items-center">
            <div className="w-4 h-2 bg-gradient-to-r from-blue-100 to-blue-200 mr-1 rounded-sm"></div>
            <span>Topic segments</span>
          </div>
          
          {/* Sentiment Legend */}
          <div className="flex items-center">
            <div className="w-4 h-2 bg-gradient-to-r from-red-200 to-green-200 mr-1 rounded-sm"></div>
            <span>Sentiment (red=negative, green=positive)</span>
          </div>
          
          {/* Playhead Legend */}
          <div className="flex items-center">
            <div className="w-0.5 h-3 bg-red-500 mr-1"></div>
            <span>Current position</span>
          </div>
          
          {/* Moment Types */}
          {Object.entries(momentStyles).map(([key, style]) => {
            const Icon = style.icon;
            return (
              <div key={key} className="flex items-center">
                <div className={`w-3 h-3 ${style.bgColor} rounded-full mr-1 flex items-center justify-center`}>
                  {Icon && <Icon className="text-white" size={8} />}
                </div>
                <span>{style.label}</span>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Main Timeline Visualization */}
      <div className="relative h-28 rounded-lg overflow-hidden shadow bg-white">
        {/* Top segment: Topic Segments */}
        <div 
          className="absolute top-0 left-0 right-0 h-12 border-b border-gray-100 cursor-pointer"
          onClick={handleTimelineClick}
        >
          {/* Topic Segments Container */}
          <div className="absolute inset-0 flex">
            {segments.map((segment, index) => {
              const segmentWidthPercent = ((segment.end - segment.start) / duration) * 100;
              const startTimeFormatted = formatTime(segment.start);
              const endTimeFormatted = formatTime(segment.end);
              const tooltipText = `Topic: ${segment.title} (${startTimeFormatted}-${endTimeFormatted})`;

              return (
                <div
                  key={index}
                  className={`segment-block h-full bg-gradient-to-r ${segment.colorFrom || 'from-blue-100'} ${segment.colorTo || 'to-blue-200'} relative transition-all hover:brightness-110 group`}
                  style={{ width: `${segmentWidthPercent}%` }}
                  title={tooltipText}
                >
                  <div className="absolute top-2 left-0 right-0 text-center z-10 pointer-events-none">
                    <span className={`px-2 py-1 bg-white/80 rounded-lg text-xs font-medium ${segment.textColor || 'text-blue-700'} shadow-sm line-clamp-1`}>
                      {segment.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Middle segment: Sentiment Analysis */}
        <div className="absolute top-12 left-0 right-0 h-8 bg-gray-50">
          {/* Sentiment visualization - gradient fill representing sentiment over time */}
          <div className="absolute inset-0">
            <svg width="100%" height="100%">
              <defs>
                <linearGradient id="sentimentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  {sentimentData.map((point, index) => {
                    // Calculate color based on sentiment value (0-1)
                    // 0 = negative (red), 0.5 = neutral (yellow), 1 = positive (green)
                    const color = point.value < 0.3 
                      ? `rgba(239, 68, 68, ${0.7 + point.value * 0.3})` // red-500 with opacity
                      : point.value < 0.7 
                        ? `rgba(245, 158, 11, ${0.7 + (point.value - 0.3) * 0.3})` // amber-500
                        : `rgba(34, 197, 94, ${0.7 + (point.value - 0.7) * 0.3})`; // green-500
                    
                    return (
                      <stop 
                        key={index} 
                        offset={`${point.position * 100}%`} 
                        stopColor={color} 
                        stopOpacity="0.7" 
                      />
                    );
                  })}
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" fill="url(#sentimentGradient)" />
            </svg>
          </div>
          
          {/* Sentiment label */}
          <div className="absolute left-2 top-1 text-xs font-medium text-gray-600 bg-white/70 px-1 rounded">
            Sentiment Flow
          </div>
        </div>
        
        {/* Bottom segment: Key Moments */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white border-t border-gray-100">
          {/* Key moments markers */}
          {moments.map((moment, index) => {
            if (!moment.timestamp || !moment.type) return null;
            
            const style = momentStyles[moment.type] || momentStyles.action;
            const Icon = style.icon;
            const positionPercent = (moment.timestamp / duration) * 100;
            
            return (
              <div 
                key={index}
                className="absolute transform -translate-x-1/2"
                style={{ left: `${positionPercent}%`, bottom: '4px' }}
                onMouseEnter={() => setHoveredMoment(moment)}
                onMouseLeave={() => setHoveredMoment(null)}
              >
                <div 
                  className={`w-4 h-4 ${style.bgColor} rounded-full flex items-center justify-center cursor-pointer shadow-sm hover:shadow hover:scale-110 transition-transform`}
                  title={`${moment.type}: ${moment.text.substring(0, 30)}...`}
                >
                  {Icon && <Icon className="text-white" size={10} />}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Playhead - vertical line showing current position */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-sm z-20 pointer-events-none" 
          style={{ left: `${playheadPositionPercent}%` }}
        ></div>
        
        {/* Time indicators */}
        <div className="absolute bottom-0 left-0 text-xs text-gray-500 px-1">
          {formatTime(0)}
        </div>
        <div className="absolute bottom-0 right-0 text-xs text-gray-500 px-1">
          {formatTime(duration)}
        </div>
      </div>
      
      {/* Hovering moment tooltip */}
      {hoveredMoment && (
        <div className="bg-white border border-gray-200 rounded-md shadow-md p-2 mt-2 text-sm max-w-lg">
          <div className="flex items-center mb-1">
            <span className="font-medium text-gray-700">{hoveredMoment.type.charAt(0).toUpperCase() + hoveredMoment.type.slice(1)}</span>
            <span className="mx-1 text-gray-400">·</span>
            <span className="text-gray-500">{formatTime(hoveredMoment.timestamp)}</span>
            {hoveredMoment.speaker && (
              <>
                <span className="mx-1 text-gray-400">·</span>
                <span className="text-gray-600">{hoveredMoment.speaker}</span>
              </>
            )}
          </div>
          <p className="text-gray-800 line-clamp-2">{hoveredMoment.text}</p>
        </div>
      )}
    </div>
  );
};

export default TimelineVisualization; 