import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Topic Distribution Chart Component
 * Visualizes the distribution of time spent on each topic during the meeting
 * 
 * @param {Object} props - Component props
 * @param {Array} props.topics - Array of topic objects with start, end, and title properties
 * @param {number} props.totalDuration - Total meeting duration in seconds
 * @param {Function} props.onTopicClick - Callback when a topic segment is clicked (receives topic object)
 */
const TopicDistributionChart = ({ topics = [], totalDuration = 0, onTopicClick }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  // Define a set of colors for the topics
  const topicColors = [
    'rgba(54, 162, 235, 0.8)', // blue
    'rgba(75, 192, 192, 0.8)',  // teal
    'rgba(255, 206, 86, 0.8)',  // yellow
    'rgba(153, 102, 255, 0.8)', // purple
    'rgba(255, 159, 64, 0.8)',  // orange
    'rgba(255, 99, 132, 0.8)',  // red
    'rgba(50, 205, 50, 0.8)',   // green
  ];
  
  // Format time (seconds) to MM:SS format
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Sort topics by duration (longest first)
  const sortedTopics = [...topics].sort((a, b) => 
    ((b.end - b.start) - (a.end - a.start))
  );
  
  useEffect(() => {
    // Clean up any existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    // Create the new chart if we have topics and a valid canvas
    if (sortedTopics.length > 0 && chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      
      // Prepare data for the chart
      const labels = sortedTopics.map(topic => topic.title);
      const durations = sortedTopics.map(topic => {
        const duration = topic.end - topic.start;
        return totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
      });
      
      // Create tooltip with exact time
      const tooltipLabels = sortedTopics.map(topic => {
        const duration = topic.end - topic.start;
        const percentage = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
        return `${formatTime(duration)} (${percentage.toFixed(1)}%)`;
      });
      
      // Create the chart
      chartInstance.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: durations,
            backgroundColor: topicColors.slice(0, sortedTopics.length),
            borderColor: 'white',
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
                  const topic = sortedTopics[index];
                  const label = context.label || '';
                  const tooltipLabel = tooltipLabels[index] || '';
                  return `${label}: ${tooltipLabel}`;
                }
              }
            },
            title: {
              display: true,
              text: 'Topic Distribution',
              font: {
                size: 16
              },
              padding: {
                top: 10,
                bottom: 20
              }
            }
          },
          // Enable click events
          onClick: (event, elements) => {
            if (elements.length > 0 && onTopicClick) {
              const index = elements[0].index;
              onTopicClick(sortedTopics[index]);
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
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [sortedTopics, totalDuration, onTopicClick]);
  
  // If no topics, show placeholder
  if (sortedTopics.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium text-gray-700 mb-4">Topic Distribution</h3>
        <div className="h-60 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">No topic data available</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium text-gray-700 mb-4">Topic Distribution</h3>
      <div className="h-60 relative">
        <canvas ref={chartRef} />
      </div>
      <div className="text-xs text-gray-500 mt-2 text-center">
        Click on segments to navigate to topics
      </div>
    </div>
  );
};

export default TopicDistributionChart; 