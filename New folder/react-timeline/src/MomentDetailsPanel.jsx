import React, { useState } from 'react';
import { X, MessageCircle, Send, Calendar, Mail, List, Play, Download, ExternalLink, FileText, Trello } from 'lucide-react';
import { getMomentStyling } from './TimelineEntry'; // Import the helper

// Helper to format comment timestamps (basic example)
const formatCommentTime = (timestamp) => {
  if (!timestamp) return 'Just now';
  // In a real app, use a library like date-fns or moment
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const MomentDetailsPanel = ({ 
  moment, // The full moment object (or null)
  commentInput, 
  onCommentInputChange, 
  onAddComment, 
  onClose,
  onPlaySegment // Add this prop for the play functionality
}) => {
  if (!moment) return null;

  const styling = getMomentStyling(moment.type);
  const momentComments = moment.comments || [];
  const [showTaskOptions, setShowTaskOptions] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

  const handleCommentSubmit = (e) => {
    e.preventDefault(); // Prevent form submission if wrapped in a form
    if (commentInput.trim()) {
      onAddComment(moment.id, commentInput); 
    }
  };

  // --- Action Handlers --- 
  const handlePlaySegment = () => {
    // Call the parent function to play this segment
    if (onPlaySegment) {
      onPlaySegment(moment.timestamp);
    }
    console.log('Play segment clicked for timestamp:', moment.timestamp);
  };

  // Calendar integration handlers
  const handleExportCalendar = () => {
    console.log('Export to Calendar clicked for moment:', moment.id);
    
    // Create calendar event data
    const title = `${moment.type ? moment.type.charAt(0).toUpperCase() + moment.type.slice(1) : 'Meeting'} Note`;
    const startTime = new Date(moment.timestamp * 1000);
    const endTime = new Date(startTime.getTime() + 30 * 60000); // Default 30 min event
    
    // Format dates for Google Calendar URL
    const formatDate = (date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '');
    };
    
    // Create Google Calendar URL
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(moment.text)}&dates=${formatDate(startTime)}/${formatDate(endTime)}`;
    
    // Open in new tab
    chrome.tabs.create({ url: calendarUrl });
  };

  // Email functionality
  const handleExportEmail = () => {
    console.log('Export to Email clicked for moment:', moment.id);
    const subject = `Meeting Note: ${moment.type} - ${moment.text.substring(0, 30)}...`;
    const body = `From meeting on ${new Date(moment.timestamp * 1000).toLocaleDateString()}:\n\nTime: ${new Date(moment.timestamp * 1000).toLocaleTimeString()}\nSpeaker: ${moment.speaker}\nType: ${moment.type}\nMoment: ${moment.text}\n\nComments:\n${momentComments.map(c => `- ${c.user}: ${c.text} (${formatCommentTime(c.timestamp)})`).join('\n') || 'None'}`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Use chrome.tabs.create for safety in extensions
    chrome.tabs.create({ url: mailtoLink });
  };

  // Task manager connection handlers
  const handleExportList = () => {
    setShowTaskOptions(!showTaskOptions);
  };

  const handleExportToTodoSystem = (system) => {
    console.log(`Export to ${system} clicked for moment:`, moment.id);
    setShowTaskOptions(false);
    
    // Format task data
    const taskTitle = `${moment.type ? moment.type.charAt(0).toUpperCase() + moment.type.slice(1) : 'Task'}: ${moment.text.substring(0, 50)}${moment.text.length > 50 ? '...' : ''}`;
    const taskDescription = `From meeting on ${new Date(moment.timestamp * 1000).toLocaleDateString()}:\nSpeaker: ${moment.speaker}\nFull context: ${moment.text}`;
    
    let taskUrl = '';
    
    switch (system) {
      case 'microsoft':
        // Microsoft To Do URL
        taskUrl = `https://to-do.live.com/tasks/create?title=${encodeURIComponent(taskTitle)}&notes=${encodeURIComponent(taskDescription)}`;
        break;
      case 'trello':
        // Trello card creation URL
        taskUrl = `https://trello.com/add-card?url=${encodeURIComponent(window.location.href)}&name=${encodeURIComponent(taskTitle)}&desc=${encodeURIComponent(taskDescription)}`;
        break;
      case 'asana':
        // Asana task creation (simplified, actual integration would require OAuth)
        taskUrl = `https://app.asana.com/0/inbox?title=${encodeURIComponent(taskTitle)}&notes=${encodeURIComponent(taskDescription)}`;
        break;
      case 'github':
        // GitHub issue (simplified, actual integration would require OAuth)
        taskUrl = `https://github.com/issues/new?title=${encodeURIComponent(taskTitle)}&body=${encodeURIComponent(taskDescription)}`;
        break;
      default:
        // Default to Microsoft To Do as fallback
        taskUrl = `https://to-do.live.com/tasks/create?title=${encodeURIComponent(taskTitle)}&notes=${encodeURIComponent(taskDescription)}`;
    }
    
    // Open in new tab
    chrome.tabs.create({ url: taskUrl });
  };

  // Export options handlers
  const handleExportOptions = () => {
    setShowExportOptions(!showExportOptions);
  };

  const handleExportFormat = (format) => {
    console.log(`Export in ${format} format clicked for moment:`, moment.id);
    setShowExportOptions(false);
    
    // For demonstration, show what would be exported
    const momentData = {
      id: moment.id,
      type: moment.type,
      text: moment.text,
      speaker: moment.speaker,
      timestamp: moment.timestamp,
      formattedTime: new Date(moment.timestamp * 1000).toLocaleTimeString(),
      comments: momentComments.map(c => ({
        user: c.user,
        text: c.text,
        timestamp: formatCommentTime(c.timestamp)
      }))
    };
    
    // In a real implementation, this would generate and download the file
    // For now, just log the data that would be exported
    console.log('Data to export:', momentData, 'Format:', format);
    
    // In a real implementation, you'd use the browser's download API
    // For example, for JSON:
    if (format === 'json') {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(momentData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `moment-${moment.id}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    }
    
    // For PDF/Markdown, you'd typically use a library to generate the file
    // This is just a placeholder
    alert(`Export in ${format.toUpperCase()} format would download the file here.`);
  };

  return (
    <div className="mb-8 p-6 border border-gray-200 rounded-xl bg-white shadow-lg relative overflow-hidden animate-fade-in">
      {/* Decorative accent */}
      <div className={`absolute top-0 left-0 w-full h-1 ${styling.bgColor.replace('from-', 'bg-').split(' ')[0]}`}></div> {/* Simplified accent */}
      
      {/* Panel content with moment details */}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div>
          <h4 className="font-semibold text-lg mb-1 text-gray-800">Moment Details</h4>
          <p className="text-sm text-gray-500">
            <span className={`font-medium ${styling.textColor}`}>{moment.type ? moment.type.charAt(0).toUpperCase() + moment.type.slice(1) : 'Info'}</span> at {new Date(moment.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-sm text-gray-600 mt-1">Speaker: <span className="font-medium">{moment.speaker || 'Unknown'}</span></p>
          <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{moment.text}</p>
        </div>
        <button 
          className="text-gray-400 hover:text-gray-600 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow-sm transition-all hover:shadow hover:scale-110 focus:outline-none focus:ring-2 focus:ring-gray-300 flex-shrink-0 ml-4"
          onClick={onClose}
          title="Close Details"
        >
          <X size={16} />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 mb-4 pt-3 border-t border-gray-100 relative z-10">
        <button 
          onClick={handlePlaySegment} 
          className="flex items-center justify-center text-xs px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-sm"
        >
          <Play size={14} className="mr-1" /> Play Segment
        </button>
        <button 
          onClick={handleExportCalendar} 
          className="flex items-center justify-center text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors shadow-sm"
        >
          <Calendar size={14} className="mr-1" /> Calendar
        </button>
        <button 
          onClick={handleExportEmail} 
          className="flex items-center justify-center text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors shadow-sm"
        >
          <Mail size={14} className="mr-1" /> Email
        </button>
        
        {/* Task Manager Dropdown */}
        <div className="relative">
          <button 
            onClick={handleExportList} 
            className="flex items-center justify-center text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors shadow-sm w-full"
          >
            <List size={14} className="mr-1" /> Task Manager
          </button>
          
          {showTaskOptions && (
            <div className="absolute left-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 z-20 w-48">
              <ul className="py-1">
                <li>
                  <button 
                    onClick={() => handleExportToTodoSystem('microsoft')}
                    className="flex items-center w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    <ExternalLink size={12} className="mr-2 text-blue-500" /> Microsoft To Do
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleExportToTodoSystem('trello')}
                    className="flex items-center w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    <Trello size={12} className="mr-2 text-blue-400" /> Trello
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleExportToTodoSystem('asana')}
                    className="flex items-center w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    <ExternalLink size={12} className="mr-2 text-orange-500" /> Asana
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleExportToTodoSystem('github')}
                    className="flex items-center w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    <ExternalLink size={12} className="mr-2 text-gray-700" /> GitHub Issue
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
        
        {/* Export Options */}
        <div className="relative">
          <button 
            onClick={handleExportOptions} 
            className="flex items-center justify-center text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors shadow-sm w-full"
          >
            <Download size={14} className="mr-1" /> Export
          </button>
          
          {showExportOptions && (
            <div className="absolute left-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 z-20 w-48">
              <ul className="py-1">
                <li>
                  <button 
                    onClick={() => handleExportFormat('pdf')}
                    className="flex items-center w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    <FileText size={12} className="mr-2 text-red-500" /> PDF Document
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleExportFormat('markdown')}
                    className="flex items-center w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    <FileText size={12} className="mr-2 text-blue-500" /> Markdown
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleExportFormat('json')}
                    className="flex items-center w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    <FileText size={12} className="mr-2 text-yellow-500" /> JSON Data
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {/* Comments section */}
      <div className="pt-4 border-t border-gray-200 relative z-10">
        <h5 className="text-sm font-medium mb-4 flex items-center text-gray-700">
          <MessageCircle size={16} className="mr-1.5 text-indigo-500" />
          <span>Comments ({momentComments.length})</span>
        </h5>
        
        {/* Comment display */}
        <div className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-2">
          {momentComments.length > 0 ? (
            momentComments.map((comment, index) => (
              <div key={index} className="p-3 bg-gradient-to-r from-gray-50 to-indigo-50/30 rounded-lg">
                <div className="flex items-start gap-3">
                  {/* Placeholder Avatar */}
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${comment.user === 'ME' ? 'from-blue-400 to-blue-500' : 'from-indigo-400 to-indigo-500'} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <span className="text-xs font-medium text-white">{comment.user?.substring(0, 2).toUpperCase() || '??'}</span>
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800">{comment.user || 'Anonymous'}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{formatCommentTime(comment.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p> 
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-gray-400 text-center py-2">No comments yet.</p>
          )}
        </div>
        
        {/* Comment input form */}
        <form onSubmit={handleCommentSubmit} className="flex gap-3 items-center">
          {/* Placeholder Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-xs font-medium text-white">ME</span>
          </div>
          <div className="flex-grow relative">
            <input 
              type="text" 
              value={commentInput}
              onChange={onCommentInputChange} // Use prop for controlled input
              placeholder="Add a comment..." 
              className="w-full py-2 px-4 pr-10 border border-gray-300 rounded-full text-sm shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-300 focus:outline-none transition-all"
            />
            <button 
              type="submit" 
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-500 hover:text-blue-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              disabled={!commentInput.trim()}
              title="Send Comment"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MomentDetailsPanel; 