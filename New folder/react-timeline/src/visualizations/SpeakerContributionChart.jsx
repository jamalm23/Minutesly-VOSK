import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';

/**
 * Speaker Contribution Chart Component
 * Visualizes the participation of different speakers during the meeting
 * 
 * @param {Object} props - Component props
 * @param {Array} props.moments - Array of moment objects with speaker and timestamp properties
 * @param {number} props.duration - Total meeting duration in seconds
 * @param {Function} props.onSpeakerClick - Callback when a speaker segment is clicked (receives speaker name)
 */
const SpeakerContributionChart = ({ moments = [], duration = 0, onSpeakerClick }) => {
  const pieChartRef = useRef(null);
  const barChartRef = useRef(null);
  const pieChartInstance = useRef(null);
  const barChartInstance = useRef(null);
  const [activeView, setActiveView] = useState('time'); // 'time', 'count', or 'words'
  
  // Generate speaker colors consistently
  const getSpeakerColor = (speakerName, alpha = 1) => {
    if (!speakerName) return `rgba(156, 163, 175, ${alpha})`; // gray-400
    
    // Simple hash function to get a consistent color for a speaker
    const hash = speakerName.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);
    
    // List of colors to choose from (based on tailwind colors)
    const colors = [
      [59, 130, 246],    // blue-500
      [16, 185, 129],    // emerald-500
      [217, 70, 239],    // fuchsia-500
      [245, 158, 11],    // amber-500
      [239, 68, 68],     // red-500
      [99, 102, 241],    // indigo-500
      [20, 184, 166],    // teal-500
      [236, 72, 153],    // pink-500
      [132, 204, 22],    // lime-500
      [168, 85, 247],    // purple-500
      [34, 211, 238],    // cyan-500
    ];
    
    // Use the hash to pick a color
    const [r, g, b] = colors[hash % colors.length];
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  // Process speaker data
  const processSpeakerData = () => {
    const speakerMap = new Map();
    
    // First pass: count instances and gather speaker data
    moments.forEach(moment => {
      const speaker = moment.speaker || 'Unknown';
      
      if (!speakerMap.has(speaker)) {
        speakerMap.set(speaker, {
          name: speaker,
          count: 0,
          words: 0,
          segments: []
        });
      }
      
      const speakerData = speakerMap.get(speaker);
      speakerData.count++;
      
      // Count words if text is available
      if (moment.text) {
        speakerData.words += moment.text.split(/\s+/).length;
      }
      
      // Store segment for time calculation
      speakerData.segments.push({
        start: moment.timestamp,
        text: moment.text || '',
      });
    });
    
    // Second pass: calculate speaking time approximation based on segments
    // Approach: calculate duration between consecutive segments of the same speaker
    for (const [speaker, data] of speakerMap.entries()) {
      // Sort segments by timestamp
      data.segments.sort((a, b) => a.start - b.start);
      
      let speakingTime = 0;
      const segments = data.segments;
      
      // For each segment, calculate an estimated duration
      segments.forEach((segment, i) => {
        // Base duration: rough estimate based on words
        // Average reading speed ~150 words per minute = 2.5 words per second
        const wordCount = segment.text.split(/\s+/).length;
        const baseDuration = Math.max(2, wordCount / 2.5); // at least 2 seconds
        
        // For last segment or if large gap to next segment, use base duration
        if (i === segments.length - 1) {
          speakingTime += baseDuration;
        } else {
          const nextSegment = segments[i + 1];
          const gap = nextSegment.start - segment.start;
          
          // If gap is reasonably small, count whole gap as speaking time
          // Otherwise, use estimated time based on words
          if (gap < baseDuration * 1.5) {
            speakingTime += gap;
          } else {
            speakingTime += baseDuration;
          }
        }
      });
      
      data.speakingTime = speakingTime;
    }
    
    // Convert map to array and calculate percentages
    const speakerData = Array.from(speakerMap.values());
    
    // Calculate total speaking time for percentage
    const totalSpeakingTime = speakerData.reduce((sum, speaker) => sum + speaker.speakingTime, 0);
    const totalCount = speakerData.reduce((sum, speaker) => sum + speaker.count, 0);
    const totalWords = speakerData.reduce((sum, speaker) => sum + speaker.words, 0);
    
    // Add percentages
    speakerData.forEach(speaker => {
      speaker.timePercentage = totalSpeakingTime > 0 
        ? (speaker.speakingTime / totalSpeakingTime) * 100 
        : 0;
      
      speaker.countPercentage = totalCount > 0 
        ? (speaker.count / totalCount) * 100 
        : 0;
      
      speaker.wordsPercentage = totalWords > 0 
        ? (speaker.words / totalWords) * 100 
        : 0;
    });
    
    // Sort by speaking time
    return speakerData.sort((a, b) => b.speakingTime - a.speakingTime);
  };
  
  const speakerData = processSpeakerData();
  
  // Format time (seconds) to MM:SS format
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Create the pie chart
  useEffect(() => {
    // Clean up any existing chart
    if (pieChartInstance.current) {
      pieChartInstance.current.destroy();
    }
    
    // Create the new chart if we have speakers and a valid canvas
    if (speakerData.length > 0 && pieChartRef.current) {
      const ctx = pieChartRef.current.getContext('2d');
      
      // Prepare data based on active view
      const getDataForView = () => {
        if (activeView === 'time') {
          return speakerData.map(speaker => speaker.speakingTime);
        }
        if (activeView === 'count') {
          return speakerData.map(speaker => speaker.count);
        }
        // words
        return speakerData.map(speaker => speaker.words);
      };
      
      const getTooltipLabelForView = (speaker) => {
        if (activeView === 'time') {
          return `${formatTime(speaker.speakingTime)} (${speaker.timePercentage.toFixed(1)}%)`;
        }
        if (activeView === 'count') {
          return `${speaker.count} segments (${speaker.countPercentage.toFixed(1)}%)`;
        }
        // words
        return `${speaker.words} words (${speaker.wordsPercentage.toFixed(1)}%)`;
      };
      
      // Create the chart
      pieChartInstance.current = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: speakerData.map(speaker => speaker.name),
          datasets: [{
            data: getDataForView(),
            backgroundColor: speakerData.map(speaker => getSpeakerColor(speaker.name, 0.7)),
            borderColor: speakerData.map(speaker => getSpeakerColor(speaker.name, 1)),
            borderWidth: 1,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                font: {
                  size: 12
                },
                padding: 15,
                usePointStyle: true,
                pointStyle: 'circle'
              },
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const index = context.dataIndex;
                  const speaker = speakerData[index];
                  const label = context.label || '';
                  return `${label}: ${getTooltipLabelForView(speaker)}`;
                }
              }
            },
            title: {
              display: false
            }
          },
          // Enable click events
          onClick: (event, elements) => {
            if (elements.length > 0 && onSpeakerClick) {
              const index = elements[0].index;
              onSpeakerClick(speakerData[index].name);
            }
          },
          animations: {
            animateRotate: true,
            animateScale: true
          }
        }
      });
    }
    
    // Clean up on unmount
    return () => {
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy();
      }
    };
  }, [speakerData, activeView, onSpeakerClick]);
  
  // Create the bar chart for distribution comparison
  useEffect(() => {
    // Clean up any existing chart
    if (barChartInstance.current) {
      barChartInstance.current.destroy();
    }
    
    // Create the new chart if we have speakers and a valid canvas
    if (speakerData.length > 0 && barChartRef.current) {
      const ctx = barChartRef.current.getContext('2d');
      
      // Keep only top 5 speakers for bar chart clarity
      const topSpeakers = speakerData.slice(0, 5);
      
      // Prepare data for all views
      const timeData = topSpeakers.map(speaker => speaker.timePercentage);
      const countData = topSpeakers.map(speaker => speaker.countPercentage);
      const wordsData = topSpeakers.map(speaker => speaker.wordsPercentage);
      
      // Create the chart
      barChartInstance.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: topSpeakers.map(speaker => speaker.name),
          datasets: [
            {
              label: 'Speaking Time',
              data: timeData,
              backgroundColor: topSpeakers.map(speaker => getSpeakerColor(speaker.name, 0.7)),
              borderColor: topSpeakers.map(speaker => getSpeakerColor(speaker.name, 1)),
              borderWidth: 1,
            },
            {
              label: 'Segment Count',
              data: countData,
              backgroundColor: topSpeakers.map(speaker => getSpeakerColor(speaker.name, 0.4)),
              borderColor: topSpeakers.map(speaker => getSpeakerColor(speaker.name, 0.7)),
              borderWidth: 1,
            },
            {
              label: 'Word Count',
              data: wordsData,
              backgroundColor: topSpeakers.map(speaker => getSpeakerColor(speaker.name, 0.2)),
              borderColor: topSpeakers.map(speaker => getSpeakerColor(speaker.name, 0.5)),
              borderWidth: 1,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Percentage (%)',
                font: {
                  size: 12
                }
              },
              max: 100
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  const value = context.parsed.y;
                  return `${context.dataset.label}: ${value.toFixed(1)}%`;
                }
              }
            },
            title: {
              display: false
            },
            legend: {
              position: 'top',
              labels: {
                font: {
                  size: 11
                },
                usePointStyle: true,
                pointStyle: 'circle'
              }
            }
          },
          // Enable click events
          onClick: (event, elements) => {
            if (elements.length > 0 && onSpeakerClick) {
              const index = elements[0].index;
              onSpeakerClick(topSpeakers[index].name);
            }
          }
        }
      });
    }
    
    // Clean up on unmount
    return () => {
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }
    };
  }, [speakerData, onSpeakerClick]);
  
  // If no speaker data, show placeholder
  if (speakerData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium text-gray-700 mb-4">Speaker Contributions</h3>
        <div className="h-60 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">No speaker data available</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-700">Speaker Contributions</h3>
        
        {/* View toggle buttons */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-md">
          <button 
            className={`text-xs py-1 px-2 rounded ${activeView === 'time' ? 'bg-white shadow text-blue-600' : 'text-gray-700'}`}
            onClick={() => setActiveView('time')}
          >
            Time
          </button>
          <button 
            className={`text-xs py-1 px-2 rounded ${activeView === 'count' ? 'bg-white shadow text-blue-600' : 'text-gray-700'}`}
            onClick={() => setActiveView('count')}
          >
            Segments
          </button>
          <button 
            className={`text-xs py-1 px-2 rounded ${activeView === 'words' ? 'bg-white shadow text-blue-600' : 'text-gray-700'}`}
            onClick={() => setActiveView('words')}
          >
            Words
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie chart showing distribution */}
        <div className="h-60 relative">
          <canvas ref={pieChartRef} />
        </div>
        
        {/* Bar chart showing comparison */}
        <div className="h-60 relative">
          <canvas ref={barChartRef} />
        </div>
      </div>
      
      <div className="text-xs text-gray-500 mt-2 text-center">
        Click on segments to filter by speaker
      </div>
    </div>
  );
};

export default SpeakerContributionChart; 