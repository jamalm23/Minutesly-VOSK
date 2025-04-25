import React from 'react';
import { Tag, HelpCircle, AlertTriangle, CheckCircle, Star, MessageCircle, ThumbsUp, ThumbsDown, Clock, User } from 'lucide-react'; // Added more icons

// Helper function to format time (e.g., seconds to MM:SS)
const formatTime = (totalSeconds) => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Generate speaker colors consistently
const getSpeakerColor = (speakerName) => {
  if (!speakerName) return { bg: 'bg-gray-200', text: 'text-gray-700' };
  
  // Simple hash function to get a consistent color for a speaker
  const hash = speakerName.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  // List of color pairs (background, text) to choose from
  const colorPairs = [
    { bg: 'bg-blue-100', text: 'text-blue-800' },
    { bg: 'bg-green-100', text: 'text-green-800' },
    { bg: 'bg-purple-100', text: 'text-purple-800' },
    { bg: 'bg-orange-100', text: 'text-orange-800' },
    { bg: 'bg-pink-100', text: 'text-pink-800' },
    { bg: 'bg-indigo-100', text: 'text-indigo-800' },
    { bg: 'bg-teal-100', text: 'text-teal-800' },
    { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  ];
  
  // Use the hash to pick a color
  const index = hash % colorPairs.length;
  return colorPairs[index];
};

// Get speaker initials
const getSpeakerInitials = (speakerName) => {
  if (!speakerName) return '?';
  
  const words = speakerName.trim().split(/\s+/);
  
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

// Helper to get styling based on moment type
// Export this function so other components can use it
export const getMomentStyling = (type) => {
  switch (type?.toLowerCase()) {
    case 'question':
      return { 
        icon: HelpCircle, 
        bgColor: 'bg-gradient-to-r from-purple-100 to-purple-200', 
        textColor: 'text-purple-700',
        borderColor: 'border-purple-400',
        hoverBg: 'hover:from-purple-50/50 hover:to-purple-50/80',
        selectedBg: 'bg-gradient-to-r from-purple-50 to-purple-100',
        label: 'Question'
      };
    case 'decision':
      return { 
        icon: CheckCircle, 
        bgColor: 'bg-gradient-to-r from-green-100 to-green-200', 
        textColor: 'text-green-700',
        borderColor: 'border-green-400',
        hoverBg: 'hover:from-green-50/50 hover:to-green-50/80',
        selectedBg: 'bg-gradient-to-r from-green-50 to-green-100',
        label: 'Decision'
      };
    case 'action':
      return { 
        icon: Star, 
        bgColor: 'bg-gradient-to-r from-yellow-100 to-yellow-200', 
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-400',
        hoverBg: 'hover:from-yellow-50/50 hover:to-yellow-50/80',
        selectedBg: 'bg-gradient-to-r from-yellow-50 to-yellow-100',
        label: 'Action Item'
      };
    case 'objection':
      return { 
        icon: AlertTriangle, 
        bgColor: 'bg-gradient-to-r from-red-100 to-red-200', 
        textColor: 'text-red-700',
        borderColor: 'border-red-400',
        hoverBg: 'hover:from-red-50/50 hover:to-red-50/80',
        selectedBg: 'bg-gradient-to-r from-red-50 to-red-100',
        label: 'Objection'
      };
    case 'feedback_positive':
      return { 
        icon: ThumbsUp, 
        bgColor: 'bg-gradient-to-r from-blue-100 to-blue-200', 
        textColor: 'text-blue-700',
        borderColor: 'border-blue-400',
        hoverBg: 'hover:from-blue-50/50 hover:to-blue-50/80',
        selectedBg: 'bg-gradient-to-r from-blue-50 to-blue-100',
        label: 'Positive Feedback'
      };
    case 'feedback_negative':
      return { 
        icon: ThumbsDown, 
        bgColor: 'bg-gradient-to-r from-gray-100 to-gray-200', 
        textColor: 'text-gray-700',
        borderColor: 'border-gray-400',
        hoverBg: 'hover:from-gray-50/50 hover:to-gray-50/80',
        selectedBg: 'bg-gradient-to-r from-gray-50 to-gray-100',
        label: 'Negative Feedback'
      };
    default: // Default / Transcript / Other
      return { 
        icon: MessageCircle, 
        bgColor: 'bg-gradient-to-r from-blue-100 to-blue-200', 
        textColor: 'text-blue-700',
        borderColor: 'border-blue-400',
        hoverBg: 'hover:from-blue-50/50 hover:to-blue-50/80',
        selectedBg: 'bg-gradient-to-r from-blue-50 to-blue-100',
        label: 'Transcript'
      };
  }
};

// Highlight matching text for search results
const highlightText = (text, searchQuery) => {
  if (!searchQuery || !text) return text;
  
  // Escape special regex characters in the search query
  const escapedSearch = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  
  // Create a regular expression that's case insensitive
  const regex = new RegExp(`(${escapedSearch})`, 'gi');
  
  // Split text by the regex matches
  const parts = text.split(regex);
  
  // If no matches (split returns original string), just return the text
  if (parts.length <= 1) return text;
  
  // Return JSX with highlighted spans
  return parts.map((part, i) => 
    regex.test(part) ? (
      <span key={i} className="bg-yellow-200 rounded px-0.5">{part}</span>
    ) : part
  );
};

const TimelineEntry = ({ moment, isSelected, onSelect, searchQuery, onSeek }) => {
  if (!moment) return null;

  const { timestamp, speaker, text, type, id } = moment;
  const styling = getMomentStyling(type);
  const MomentIcon = styling.icon; // Get the icon component
  const speakerColors = getSpeakerColor(speaker);
  const speakerInitials = getSpeakerInitials(speaker);

  const handleClick = () => {
    onSelect(isSelected ? null : id); // Pass ID up, or null to deselect
  };
  
  // Handle timestamp click for navigation
  const handleTimestampClick = (e) => {
    e.stopPropagation(); // Prevent triggering the parent's onClick
    if (onSeek && typeof timestamp === 'number') {
      onSeek(timestamp);
    }
  };

  // Check if this entry matches the search query
  const matchesSearch = searchQuery && searchQuery.trim() !== '' &&
    (text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     speaker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     type?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div
      className={`flex py-4 px-4 cursor-pointer transition-all duration-150 ease-in-out ${styling.hoverBg} 
        ${isSelected ? `${styling.selectedBg} border-l-4 ${styling.borderColor}` : 'border-l-4 border-transparent even:bg-white odd:bg-gray-50/50'}
        ${matchesSearch ? 'bg-yellow-50' : ''}`}
      onClick={handleClick}
    >
      {/* Time */}
      <div className="w-1/6 flex items-center pr-2">
        <div 
          className={`h-8 w-16 rounded-md ${styling.bgColor} flex items-center justify-center text-xs font-medium ${styling.textColor} shadow-sm flex-shrink-0 cursor-pointer hover:brightness-95 transition-all`}
          onClick={handleTimestampClick}
          title={`Jump to ${formatTime(timestamp)}`}
        >
          <Clock size={12} className="mr-1" />
          {formatTime(timestamp)}
        </div>
      </div>

      {/* Speaker */}
      <div className="w-1/6 flex items-center pr-2">
        {/* Speaker Avatar with Initials */}
        <div className={`h-8 w-8 rounded-full ${speakerColors.bg} mr-2 flex-shrink-0 flex items-center justify-center ${speakerColors.text} font-medium text-sm shadow-sm`}>
          {speakerInitials}
        </div>
        <span className="text-sm font-medium text-gray-700 truncate" title={speaker}>
          {searchQuery ? highlightText(speaker || 'Unknown', searchQuery) : (speaker || 'Unknown')}
        </span>
      </div>

      {/* Content */}
      <div className="w-1/2 flex items-center pr-2">
        <p className="text-sm text-gray-600 line-clamp-2" title={text}>
          {searchQuery ? highlightText(text || '', searchQuery) : (text || '')}
        </p>
      </div>

      {/* Type Tag */}
      <div className="w-1/6 flex items-center">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styling.bgColor} ${styling.textColor} shadow-sm`}>
          <MomentIcon size={14} className="mr-1" />
          {styling.label}
        </span>
      </div>
    </div>
  );
};

export default TimelineEntry; 