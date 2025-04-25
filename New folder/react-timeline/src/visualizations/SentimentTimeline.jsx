import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Sentiment Timeline Component
 * Visualizes the emotional flow throughout the meeting
 * 
 * @param {Object} props - Component props
 * @param {Array} props.sentimentData - Array of objects with position (0-1) and value (0-1) properties
 * @param {number} props.duration - Total meeting duration in seconds
 * @param {number} props.currentTime - Current playback position in seconds
 * @param {Function} props.onPointClick - Callback when a data point is clicked (receives timestamp)
 */
const SentimentTimeline = ({ sentimentData = [], duration = 0, currentTime = 0, onPointClick }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  // Format time (seconds) to MM:SS format
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  useEffect(() => {
    // Clean up any existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    // Create the new chart if we have sentiment data and a valid canvas
    if (sentimentData.length > 0 && chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      
      // Prepare data for the chart
      const data = sentimentData.map(point => ({
        x: point.position * duration, // Convert position to seconds
        y: point.value
      }));
      
      // Define gradient for line
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, 'rgba(34, 197, 94, 0.8)');  // Green (positive)
      gradient.addColorStop(0.5, 'rgba(234, 179, 8, 0.8)'); // Yellow (neutral)
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.8)');   // Red (negative)
      
      // Create the chart
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [{
            label: 'Sentiment',
            data: data,
            borderColor: 'rgba(54, 162, 235, 0.8)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: (context) => {
              const value = context.raw.y;
              if (value >= 0.7) return 'rgba(34, 197, 94, 1)';  // Green (positive)
              if (value >= 0.3) return 'rgba(234, 179, 8, 1)';  // Yellow (neutral)
              return 'rgba(239, 68, 68, 1)';                    // Red (negative)
            },
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: 'Time (MM:SS)',
                font: {
                  size: 12
                }
              },
              ticks: {
                callback: function(value) {
                  return formatTime(value);
                }
              },
              min: 0,
              max: duration
            },
            y: {
              title: {
                display: true,
                text: 'Sentiment',
                font: {
                  size: 12
                }
              },
              min: 0,
              max: 1,
              ticks: {
                callback: function(value) {
                  if (value === 1) return 'Very Positive';
                  if (value === 0.75) return 'Positive';
                  if (value === 0.5) return 'Neutral';
                  if (value === 0.25) return 'Negative';
                  if (value === 0) return 'Very Negative';
                  return '';
                }
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                title: function(tooltipItems) {
                  const time = tooltipItems[0].parsed.x;
                  return `Time: ${formatTime(time)}`;
                },
                label: function(context) {
                  const value = context.parsed.y;
                  let sentiment = '';
                  if (value >= 0.8) sentiment = 'Very Positive';
                  else if (value >= 0.6) sentiment = 'Positive';
                  else if (value >= 0.4) sentiment = 'Neutral';
                  else if (value >= 0.2) sentiment = 'Negative';
                  else sentiment = 'Very Negative';
                  return `Sentiment: ${sentiment} (${(value * 100).toFixed(0)}%)`;
                }
              }
            },
            title: {
              display: true,
              text: 'Sentiment Timeline',
              font: {
                size: 16
              },
              padding: {
                top: 10,
                bottom: 20
              }
            },
            legend: {
              display: false
            }
          },
          // Enable click events
          onClick: (event, elements) => {
            if (elements.length > 0 && onPointClick) {
              const dataIndex = elements[0].index;
              const timestamp = data[dataIndex].x;
              onPointClick(timestamp);
            }
          },
          // Custom annotation for current playback position
          annotation: {
            annotations: {
              line1: {
                type: 'line',
                xMin: currentTime,
                xMax: currentTime,
                borderColor: 'rgba(255, 0, 0, 0.8)',
                borderWidth: 2,
              }
            }
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
  }, [sentimentData, duration, onPointClick]);
  
  // Update playhead position without full re-render
  useEffect(() => {
    if (chartInstance.current && chartInstance.current.options.annotation?.annotations?.line1) {
      chartInstance.current.options.annotation.annotations.line1.xMin = currentTime;
      chartInstance.current.options.annotation.annotations.line1.xMax = currentTime;
      chartInstance.current.update();
    }
  }, [currentTime]);
  
  // If no sentiment data, show placeholder
  if (sentimentData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-medium text-gray-700 mb-4">Sentiment Timeline</h3>
        <div className="h-60 flex items-center justify-center bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">No sentiment data available</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium text-gray-700 mb-4">Sentiment Timeline</h3>
      <div className="h-60 relative">
        <canvas ref={chartRef} />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
          <span>Negative</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-yellow-500 mr-1"></div>
          <span>Neutral</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
          <span>Positive</span>
        </div>
      </div>
      <div className="text-xs text-gray-500 mt-2 text-center">
        Click on data points to navigate to that moment
      </div>
    </div>
  );
};

export default SentimentTimeline; 