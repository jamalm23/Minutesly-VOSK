import React, { useEffect, useRef, useState } from 'react';

/**
 * AudioWaveform Component
 * Renders an interactive waveform visualization of the audio track
 * 
 * @param {Object} props - Component props
 * @param {string} props.audioUrl - URL to the audio file
 * @param {number} props.currentTime - Current playback position in seconds
 * @param {number} props.duration - Total duration of audio in seconds
 * @param {Function} props.onSeek - Callback when user seeks to a new position
 * @param {boolean} props.isPlaying - Whether audio is currently playing
 */
const AudioWaveform = ({ audioUrl, currentTime, duration, onSeek, isPlaying }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [waveformData, setWaveformData] = useState(null);
  const [hoveredPosition, setHoveredPosition] = useState(null);
  
  // Generate or load waveform data
  useEffect(() => {
    if (!audioUrl) return;
    
    const loadAudioAndGenerateWaveform = async () => {
      try {
        // Create audio context and fetch audio data
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        // Decode audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Get the raw audio data (first channel for mono waveform)
        const rawData = audioBuffer.getChannelData(0);
        
        // Downsample the data for visualization (prevent drawing too many points)
        const points = 300; // Number of data points to display
        const blockSize = Math.floor(rawData.length / points);
        const downsampledData = [];
        
        for (let i = 0; i < points; i++) {
          const blockStart = blockSize * i;
          let sum = 0;
          
          // Find the max value in this block to represent the peak
          for (let j = 0; j < blockSize; j++) {
            const sampleValue = Math.abs(rawData[blockStart + j] || 0);
            sum = Math.max(sum, sampleValue);
          }
          
          downsampledData.push(sum);
        }
        
        // Normalize to 0-1 range
        const maxValue = Math.max(...downsampledData);
        const normalizedData = downsampledData.map(val => val / maxValue);
        
        setWaveformData(normalizedData);
        setIsLoaded(true);
      } catch (error) {
        console.error('Error processing audio for waveform:', error);
        // Provide fallback data with some randomness to still have visualization
        const fallbackData = Array(300).fill(0).map(() => Math.random() * 0.5 + 0.1);
        setWaveformData(fallbackData);
        setIsLoaded(true);
      }
    };
    
    loadAudioAndGenerateWaveform();
    
    // Cleanup function
    return () => {
      setIsLoaded(false);
      setWaveformData(null);
    };
  }, [audioUrl]);
  
  // Draw waveform to canvas
  useEffect(() => {
    if (!waveformData || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Get canvas dimensions
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate bar width
    const barWidth = width / waveformData.length;
    const barSpacing = 1; // Gap between bars
    const barWidthWithSpacing = Math.max(1, barWidth - barSpacing);
    
    // Draw waveform
    ctx.fillStyle = '#E5E7EB'; // Light gray for unplayed segments
    
    // Draw all bars in background color
    waveformData.forEach((value, index) => {
      const barHeight = Math.max(2, value * height * 0.8); // Min height of 2px, max of 80% canvas height
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      
      ctx.fillRect(x, y, barWidthWithSpacing, barHeight);
    });
    
    // Calculate current position
    const playedWidth = (currentTime / duration) * width;
    
    // Draw played portion in different color
    ctx.fillStyle = '#3B82F6'; // Blue for played segments
    
    waveformData.forEach((value, index) => {
      const barHeight = Math.max(2, value * height * 0.8);
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      
      // Only draw if this bar is in the played portion
      if (x < playedWidth) {
        ctx.fillRect(x, y, barWidthWithSpacing, barHeight);
      }
    });
    
    // Draw hover position if available
    if (hoveredPosition !== null) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(hoveredPosition, 0, 2, height);
    }
    
    // Draw playhead
    ctx.fillStyle = '#DC2626'; // Red for playhead
    ctx.fillRect(playedWidth, 0, 2, height);
    
  }, [waveformData, currentTime, duration, hoveredPosition]);
  
  // Handle user interaction for seeking
  const handleWaveformClick = (e) => {
    if (!containerRef.current || !duration) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const seekTime = (clickPosition / rect.width) * duration;
    
    if (onSeek) {
      onSeek(seekTime);
    }
  };
  
  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const hoverPosition = e.clientX - rect.left;
    setHoveredPosition(hoverPosition);
  };
  
  const handleMouseLeave = () => {
    setHoveredPosition(null);
  };
  
  // Format time as MM:SS
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="relative mt-4">
      <div
        ref={containerRef}
        className={`relative h-24 bg-gray-50 rounded-lg cursor-pointer overflow-hidden ${isLoaded ? '' : 'animate-pulse'}`}
        onClick={handleWaveformClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Fallback when waveform can't be generated */}
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Loading waveform...</p>
          </div>
        )}
        
        {/* Canvas for waveform */}
        <canvas ref={canvasRef} className="w-full h-full" />
        
        {/* Current time tooltip on hover */}
        {hoveredPosition !== null && (
          <div 
            className="absolute top-0 bg-white shadow-md rounded-md px-2 py-1 text-xs pointer-events-none transform -translate-x-1/2"
            style={{ left: `${hoveredPosition}px` }}
          >
            {formatTime((hoveredPosition / containerRef.current?.getBoundingClientRect().width) * duration)}
          </div>
        )}
      </div>
      
      {/* Time labels */}
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>00:00</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

export default AudioWaveform; 