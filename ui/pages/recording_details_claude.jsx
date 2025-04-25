import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pause, Download, Share2, Trash2, MoreVertical, MessageSquare, Clock, CheckCircle, AlertCircle, Tag, Flag, ChevronDown, Search, Edit3, Bookmark, ThumbsUp, ThumbsDown, Mail, Calendar, List, Plus, ExternalLink, MessageCircle, Send, CornerDownRight, Star, Zap, HelpCircle, Users, X, Filter } from 'lucide-react';

const RecordingDetails = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTab, setCurrentTab] = useState('transcript');
  const [currentTime, setCurrentTime] = useState(0);
  const [viewMode, setViewMode] = useState('standard');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showInsights, setShowInsights] = useState(false);
  const [timelineSearch, setTimelineSearch] = useState('');
  const [selectedMoment, setSelectedMoment] = useState(null);
  const [commentInput, setCommentInput] = useState('');
  const [activeFilters, setActiveFilters] = useState({
    questions: true,
    decisions: true,
    objections: true,
    actions: true,
    feedback: true,
    all: true
  });
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white p-4 shadow flex items-center">
        <button className="text-blue-500 mr-4">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-medium">recording-1744668699209.webm</h1>
          <p className="text-sm text-gray-500">4/14/2025, 11:44:59 PM • 00:03 • 47.6 KB</p>
        </div>
        <div className="flex gap-2">
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Download size={20} />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <Share2 size={20} />
          </button>
          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
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
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
            </button>
          </div>
          <div className="text-sm text-gray-500">Cline - AI Autonomous Coding Agent for VS Code</div>
        </div>
        
        {/* Enhanced Waveform with Interactive Elements */}
        <div className="w-full h-20 bg-gray-100 rounded-md mb-2 overflow-hidden">
          <div className="h-full w-full flex flex-col">
            {/* Sentiment and topic markers */}
            <div className="h-4 w-full flex">
              <div className="w-1/6 h-full bg-green-200 rounded-t-sm" title="Positive sentiment"></div>
              <div className="w-2/6 h-full bg-blue-200" title="Topic: Introduction"></div>
              <div className="w-3/6 h-full bg-purple-200 rounded-t-sm" title="Topic: Features"></div>
            </div>
            
            {/* Interactive waveform visualization */}
            <div className="flex items-center h-16 gap-px px-2 cursor-pointer relative">
              <div className="absolute inset-0 flex items-center">
                <div className="h-full w-px bg-blue-500 absolute" style={{ left: `${(currentTime/3)*100}%` }}></div>
              </div>
              {Array.from({ length: 60 }).map((_, i) => (
                <div 
                  key={i} 
                  className="w-1 transition-all hover:opacity-100" 
                  style={{ 
                    height: `${Math.sin(i / 3) * 24 + 30}px`,
                    backgroundColor: i < 20 ? '#60A5FA' : i < 40 ? '#818CF8' : '#A78BFA',
                    opacity: Math.abs((i/60) - (currentTime/3)) < 0.1 ? 1 : 0.6
                  }}
                  onClick={() => setCurrentTime((i/60) * 3)}
                ></div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Audio timeline */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>00:00</span>
          <span>00:03</span>
        </div>
        
        {/* Enhanced Audio controls */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button className="text-gray-500 p-2 hover:bg-gray-100 rounded-full">
              <Clock size={20} />
            </button>
            {/* Playback speed selector */}
            <div className="relative group">
              <button className="flex items-center gap-1 text-sm bg-gray-100 rounded-md px-2 py-1 hover:bg-gray-200">
                <span>{playbackSpeed}x</span>
                <span className="text-xs text-gray-500">▼</span>
              </button>
              <div className="absolute left-0 mt-1 bg-white shadow-lg rounded-md p-1 hidden group-hover:block z-10">
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(speed => (
                  <button 
                    key={speed} 
                    className={`block w-full text-left px-4 py-1 text-sm rounded hover:bg-gray-100 ${speed === playbackSpeed ? 'bg-blue-50 text-blue-600' : ''}`}
                    onClick={() => setPlaybackSpeed(speed)}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* View mode toggle */}
          <div className="flex items-center bg-gray-100 rounded-md p-1">
            <button 
              className={`px-3 py-1 text-xs rounded ${viewMode === 'standard' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
              onClick={() => setViewMode('standard')}
            >
              Standard
            </button>
            <button 
              className={`px-3 py-1 text-xs rounded ${viewMode === 'compact' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
              onClick={() => setViewMode('compact')}
            >
              Compact
            </button>
            <button 
              className={`px-3 py-1 text-xs rounded ${viewMode === 'detailed' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}`}
              onClick={() => setViewMode('detailed')}
            >
              Detailed
            </button>
          </div>
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
              <span className="text-sm">Not Transcribed</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Summary</p>
            <div className="flex items-center gap-1 mt-1">
              <AlertCircle size={16} className="text-orange-500" />
              <span className="text-sm">Not Generated</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Language</p>
            <p className="text-sm font-medium">N/A</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Speakers</p>
            <p className="text-sm font-medium">N/A</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Importance</p>
            <p className="text-sm font-medium">N/A</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Sentiment</p>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span className="text-sm">Neutral</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500">Actions</p>
            <p className="text-sm font-medium">0</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Follow-up</p>
            <p className="text-sm font-medium">No</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Topics</p>
            <p className="text-sm font-medium">N/A</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Keywords</p>
            <p className="text-sm font-medium">N/A</p>
          </div>
        </div>
        
        {/* AI Insights Section - expandable */}
        {showInsights && (
          <div className="p-4 bg-blue-50 border-b border-blue-100">
            <h4 className="font-medium text-sm text-blue-800 mb-3">AI-Powered Insights</h4>
            
            {/* Sample visualizations that would appear when data is available */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sentiment Analysis */}
              <div className="bg-white p-3 rounded-md shadow-sm">
                <h5 className="text-sm font-medium mb-2">Sentiment Timeline</h5>
                <div className="h-24 flex items-end space-x-1">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const height = 15 + Math.sin(i/3) * 10;
                    let color = 'bg-gray-300';
                    if (height > 20) color = 'bg-green-400';
                    if (height < 15) color = 'bg-red-400';
                    
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div 
                          className={`w-full ${color} rounded-t`} 
                          style={{ height: `${height}px` }}
                        ></div>
                        {i % 5 === 0 && <span className="text-xs text-gray-500 mt-1">{i}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Topic Distribution */}
              <div className="bg-white p-3 rounded-md shadow-sm">
                <h5 className="text-sm font-medium mb-2">Topic Distribution</h5>
                <div className="relative pt-1">
                  <div className="flex mb-2">
                    <div className="w-full rounded-full h-4 bg-gray-200">
                      <div className="flex h-full rounded-full overflow-hidden">
                        <div className="bg-blue-400 w-1/4"></div>
                        <div className="bg-purple-400 w-2/5"></div>
                        <div className="bg-green-400 w-1/5"></div>
                        <div className="bg-yellow-400 w-3/20"></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span className="inline-flex items-center">
                      <span className="w-2 h-2 bg-blue-400 mr-1 rounded-full"></span>
                      Introduction
                    </span>
                    <span className="inline-flex items-center">
                      <span className="w-2 h-2 bg-purple-400 mr-1 rounded-full"></span>
                      Features
                    </span>
                    <span className="inline-flex items-center">
                      <span className="w-2 h-2 bg-green-400 mr-1 rounded-full"></span>
                      Demo
                    </span>
                    <span className="inline-flex items-center">
                      <span className="w-2 h-2 bg-yellow-400 mr-1 rounded-full"></span>
                      Q&A
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
            Meeting Memory Timeline
          </button>
          <button 
            className={`px-6 py-3 text-sm font-medium border-b-2 ${currentTab === 'summary' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}
            onClick={() => setCurrentTab('summary')}
          >
            Summary
          </button>
          <button 
            className={`px-6 py-3 text-sm font-medium border-b-2 ${currentTab === 'actions' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500'}`}
            onClick={() => setCurrentTab('actions')}
          >
            Actions
          </button>
        </div>
        
        {/* Tab content */}
        <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
          {currentTab === 'transcript' && (
            <div className="w-full max-w-4xl">
              {/* Interactive demo mode toggle */}
              <div className="mb-8 flex justify-center">
                <div className="relative inline-block">
                  <div className="w-12 h-6 bg-blue-100 rounded-full p-1 flex cursor-pointer" onClick={() => setShowInsights(!showInsights)}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${showInsights ? 'translate-x-6' : ''}`}></div>
                  </div>
                  <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap">
                    {showInsights ? 'Demo Mode: On' : 'Demo Mode: Off'}
                  </span>
                </div>
              </div>
              
              {!showInsights ? (
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
              ) : (
                <div className="w-full">
                  {/* Interactive transcript demo */}
                  <div className="flex p-4 bg-blue-50 rounded-md mb-6 text-sm">
                    <div className="text-blue-700 flex-shrink-0 mr-2">ℹ️</div>
                    <div className="text-blue-700">
                      This is a demo view showing how the transcript would look once generated.
                    </div>
                  </div>
                  
                  <div className="flex mb-4">
                    <div className="p-2 bg-blue-100 rounded-md">
                      <div className="flex gap-2 text-sm font-medium text-gray-700">
                        <button className="px-3 py-1 bg-white rounded shadow text-blue-600">All</button>
                        <button className="px-3 py-1 hover:bg-white/50 rounded">Speaker 1</button>
                        <button className="px-3 py-1 hover:bg-white/50 rounded">Speaker 2</button>
                      </div>
                    </div>
                    <div className="ml-auto">
                      <div className="relative">
                        <input 
                          type="text" 
                          placeholder="Search transcript..." 
                          className="py-2 px-3 pr-8 border border-gray-300 rounded-md text-sm"
                        />
                        <div className="absolute right-2 top-2 text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sample transcript content */}
                  <div className="space-y-6">
                    <div className={`p-4 rounded-md transition-all ${currentTime >= 0 && currentTime < 1 ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white hover:bg-gray-50'}`}>
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                          <span className="text-sm font-medium text-blue-700">S1</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Speaker 1</p>
                          <p className="text-xs text-gray-500">00:00 - 00:01</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <button className="text-gray-400 hover:text-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                          </button>
                          <button className="text-gray-400 hover:text-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path></svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-700">Hello and welcome to the demo of Cline, an AI autonomous coding agent for VS Code.</p>
                    </div>

                    <div className={`p-4 rounded-md transition-all ${currentTime >= 1 && currentTime < 2 ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white hover:bg-gray-50'}`}>
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-2">
                          <span className="text-sm font-medium text-purple-700">S2</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Speaker 2</p>
                          <p className="text-xs text-gray-500">00:01 - 00:02</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <button className="text-gray-400 hover:text-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                          </button>
                          <button className="text-gray-400 hover:text-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path></svg>
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-700">Thanks for showing us this tool. I'm excited to see how it can help with our development workflow.</p>
                    </div>

                    <div className={`p-4 rounded-md transition-all ${currentTime >= 2 ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-white hover:bg-gray-50'}`}>
                      <div className="flex items-center mb-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                          <span className="text-sm font-medium text-blue-700">S1</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Speaker 1</p>
                          <p className="text-xs text-gray-500">00:02 - 00:03</p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <button className="text-gray-400 hover:text-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                          </button>
                          <button className="text-gray-400 hover:text-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"></path></svg>
                          </button>
                          <div className="px-2 py-1 bg-yellow-100 rounded text-xs text-yellow-700 flex items-center">
                            <Flag size={12} className="mr-1" /> Action Item
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-700">Let's schedule a follow-up meeting next week to discuss implementation details and integration with our existing tools.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {currentTab === 'summary' && (
            <div className="w-full max-w-4xl">
              {/* Same demo mode toggle as transcript */}
              <div className="mb-8 flex justify-center">
                <div className="relative inline-block">
                  <div className="w-12 h-6 bg-blue-100 rounded-full p-1 flex cursor-pointer" onClick={() => setShowInsights(!showInsights)}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${showInsights ? 'translate-x-6' : ''}`}></div>
                  </div>
                  <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap">
                    {showInsights ? 'Demo Mode: On' : 'Demo Mode: Off'}
                  </span>
                </div>
              </div>
              
              {!showInsights ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquare size={24} className="text-blue-500" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Summary Available</h3>
                  <p className="text-gray-500 mb-6">Generate a transcript first, then you'll be able to create a summary of this recording.</p>
                  <button className="px-4 py-2 bg-gray-200 text-gray-500 rounded-md font-medium cursor-not-allowed">
                    Generate Summary
                  </button>
                </div>
              ) : (
                <div className="w-full">
                  {/* Interactive summary demo */}
                  <div className="flex p-4 bg-blue-50 rounded-md mb-6 text-sm">
                    <div className="text-blue-700 flex-shrink-0 mr-2">ℹ️</div>
                    <div className="text-blue-700">
                      This is a demo view showing how the summary would look once generated.
                    </div>
                  </div>
                  
                  {/* Summary control panel */}
                  <div className="flex mb-6">
                    <div className="flex gap-2 items-center">
                      <span className="text-sm font-medium text-gray-700">Summary Length:</span>
                      <div className="p-1 bg-gray-100 rounded-md">
                        <div className="flex gap-1 text-sm">
                          <button className="px-3 py-1 bg-white rounded shadow text-blue-600">Brief</button>
                          <button className="px-3 py-1 hover:bg-white/50 rounded">Detailed</button>
                          <button className="px-3 py-1 hover:bg-white/50 rounded">Full</button>
                        </div>
                      </div>
                    </div>
                    <div className="ml-auto">
                      <button className="flex items-center gap-1 text-sm text-blue-600 border border-blue-300 rounded-md px-3 py-1.5 hover:bg-blue-50">
                        <Edit3 size={14} />
                        <span>Edit</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Summary content */}
                  <div className="space-y-6">
                    <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-100">
                      <h3 className="text-lg font-medium mb-4">Meeting Summary</h3>
                      
                      <div className="space-y-4">
                        <p className="text-gray-700">
                          This brief meeting was an introduction to Cline, an AI autonomous coding agent for VS Code. The presenter demonstrated the tool's capabilities and discussed how it integrates with the development workflow.
                        </p>
                      
                        <div className="border-t border-gray-100 pt-4">
                          <h4 className="text-md font-medium mb-2">Key Points</h4>
                          <ul className="list-disc pl-5 space-y-1 text-gray-700">
                            <li>Introduction to Cline's core features</li>
                            <li>Discussion of VS Code integration</li>
                            <li>Brief demo of the autonomous coding capabilities</li>
                          </ul>
                        </div>
                        
                        <div className="border-t border-gray-100 pt-4">
                          <h4 className="text-md font-medium mb-2">Action Items</h4>
                          <div className="p-3 bg-yellow-50 rounded border border-yellow-200 flex items-start">
                            <Flag size={16} className="text-yellow-600 mt-0.5 mr-2" />
                            <div>
                              <p className="text-gray-800 text-sm font-medium">Schedule follow-up meeting</p>
                              <p className="text-gray-600 text-xs">Next week - Discuss implementation details and integration with existing tools</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Interactive feedback */}
                      <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                            <Bookmark size={14} />
                            <span>Save</span>
                          </button>
                          <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600">
                            <Share2 size={14} />
                            <span>Share</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">Was this summary helpful?</span>
                          <div className="flex gap-2">
                            <button className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-green-500">
                              <ThumbsUp size={16} />
                            </button>
                            <button className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-red-500">
                              <ThumbsDown size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {currentTab === 'timeline' && (
            <div className="w-full max-w-6xl">
              {/* Demo mode toggle */}
              <div className="mb-8 flex justify-center">
                <div className="relative inline-block">
                  <div className="w-12 h-6 bg-blue-100 rounded-full p-1 flex cursor-pointer" onClick={() => setShowInsights(!showInsights)}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${showInsights ? 'translate-x-6' : ''}`}></div>
                  </div>
                  <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap">
                    {showInsights ? 'Demo Mode: On' : 'Demo Mode: Off'}
                  </span>
                </div>
              </div>
              
              {!showInsights ? (
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock size={24} className="text-blue-500" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Meeting Memory Timeline Not Available</h3>
                  <p className="text-gray-500 mb-6">Generate a transcript first to access the interactive Meeting Memory Timeline.</p>
                  <button className="px-4 py-2 bg-gray-200 text-gray-500 rounded-md font-medium cursor-not-allowed">
                    Generate Timeline
                  </button>
                </div>
              ) : (
                <div className="w-full">
                  {/* Interactive timeline demo */}
                  <div className="flex p-4 bg-blue-50 rounded-md mb-6 text-sm">
                    <div className="text-blue-700 flex-shrink-0 mr-2">ℹ️</div>
                    <div className="text-blue-700">
                      This is a demo view showing how the Meeting Memory Timeline would look once generated.
                    </div>
                  </div>
                  
                  {/* Advanced search and controls with visual enhancement */}
                  <div className="flex flex-col md:flex-row gap-3 mb-6">
                    <div className="relative flex-grow">
                      <input 
                        type="text" 
                        value={timelineSearch}
                        onChange={(e) => setTimelineSearch(e.target.value)}
                        placeholder="Search timeline or try 'timeline: objection', 'who mentioned pricing'..." 
                        className="w-full py-2 px-4 pr-10 border border-gray-300 rounded-full text-sm bg-white shadow-sm transition-all focus:ring-2 focus:ring-blue-200 focus:border-blue-400 focus:outline-none"
                      />
                      <button className="absolute right-3 top-2 text-blue-400">
                        <Search size={16} />
                      </button>
                    </div>
                    
                    {/* Filter controls with visual flair */}
                    <div className="flex gap-2">
                      <div className="relative group">
                        <button className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 rounded-full text-sm flex items-center gap-1 text-indigo-600 shadow-sm transition-all hover:shadow">
                          <Filter size={14} />
                          <span>Filters</span>
                        </button>
                        <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-xl p-3 hidden group-hover:block z-10 w-52 border border-indigo-100">
                          <div className="p-2">
                            <label className="flex items-center gap-2 text-sm mb-2 hover:bg-indigo-50 p-1 rounded-md transition-colors">
                              <input 
                                type="checkbox" 
                                checked={activeFilters.all} 
                                onChange={() => setActiveFilters({...activeFilters, all: !activeFilters.all})}
                                className="rounded text-indigo-500"
                              />
                              <span>All Event Types</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm mb-2 hover:bg-indigo-50 p-1 rounded-md transition-colors">
                              <input 
                                type="checkbox" 
                                checked={activeFilters.questions} 
                                onChange={() => setActiveFilters({...activeFilters, questions: !activeFilters.questions})}
                                className="rounded text-indigo-500"
                              />
                              <span>Questions</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm mb-2 hover:bg-indigo-50 p-1 rounded-md transition-colors">
                              <input 
                                type="checkbox" 
                                checked={activeFilters.decisions} 
                                onChange={() => setActiveFilters({...activeFilters, decisions: !activeFilters.decisions})}
                                className="rounded text-indigo-500"
                              />
                              <span>Decisions</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm mb-2 hover:bg-indigo-50 p-1 rounded-md transition-colors">
                              <input 
                                type="checkbox" 
                                checked={activeFilters.objections} 
                                onChange={() => setActiveFilters({...activeFilters, objections: !activeFilters.objections})}
                                className="rounded text-indigo-500"
                              />
                              <span>Objections</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm mb-2 hover:bg-indigo-50 p-1 rounded-md transition-colors">
                              <input 
                                type="checkbox" 
                                checked={activeFilters.actions} 
                                onChange={() => setActiveFilters({...activeFilters, actions: !activeFilters.actions})}
                                className="rounded text-indigo-500"
                              />
                              <span>Action Items</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm hover:bg-indigo-50 p-1 rounded-md transition-colors">
                              <input 
                                type="checkbox" 
                                checked={activeFilters.feedback} 
                                onChange={() => setActiveFilters({...activeFilters, feedback: !activeFilters.feedback})}
                                className="rounded text-indigo-500"
                              />
                              <span>Feedback</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      
                      <button className="px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-full text-sm flex items-center gap-1 text-emerald-600 shadow-sm transition-all hover:shadow">
                        <Download size={14} />
                        <span>Export</span>
                      </button>
                      
                      <div className="relative group">
                        <button className="px-3 py-2 bg-gradient-to-r from-purple-50 to-fuchsia-50 hover:from-purple-100 hover:to-fuchsia-100 rounded-full text-sm flex items-center gap-1 text-fuchsia-600 shadow-sm transition-all hover:shadow">
                          <Share2 size={14} />
                          <span>Share</span>
                        </button>
                        <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-xl p-2 hidden group-hover:block z-10 w-48 border border-purple-100">
                          <button className="flex items-center gap-2 p-2 text-sm w-full text-left hover:bg-purple-50 rounded-lg transition-colors">
                            <Mail size={14} className="text-purple-600" />
                            <span>Email</span>
                          </button>
                          <button className="flex items-center gap-2 p-2 text-sm w-full text-left hover:bg-purple-50 rounded-lg transition-colors">
                            <Calendar size={14} className="text-purple-600" />
                            <span>Calendar</span>
                          </button>
                          <button className="flex items-center gap-2 p-2 text-sm w-full text-left hover:bg-purple-50 rounded-lg transition-colors">
                            <List size={14} className="text-purple-600" />
                            <span>Task Manager</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Timeline visualization - Enhanced with fluid design */}
                  <div className="mb-8 relative">
                    {/* Timeline header with timestamps */}
                    <div className="flex border-b border-indigo-100 py-3 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
                      <div className="w-1/6 text-xs font-medium text-indigo-700">Time</div>
                      <div className="w-1/6 text-xs font-medium text-indigo-700">Speaker</div>
                      <div className="w-1/2 text-xs font-medium text-indigo-700">Content</div>
                      <div className="w-1/6 text-xs font-medium text-indigo-700">Type</div>
                    </div>
                    
                    {/* Background with decorative elements */}
                    <div className="absolute left-0 top-12 bottom-0 w-1/6 border-r border-indigo-50">
                      <div className="absolute h-px w-full top-1/4 bg-indigo-50"></div>
                      <div className="absolute h-px w-full top-2/4 bg-indigo-50"></div>
                      <div className="absolute h-px w-full top-3/4 bg-indigo-50"></div>
                      <div className="absolute h-full w-0.5 left-1/3 top-0 bg-gradient-to-b from-blue-100/0 via-blue-100 to-blue-100/0"></div>
                    </div>
                    
                    {/* Timeline entries with enhanced visuals */}
                    <div className="relative z-10 rounded-b-lg overflow-hidden shadow-sm">
                      {/* Timeline moment - Introduction */}
                      <div 
                        className={`flex py-4 px-4 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-blue-50/80 cursor-pointer transition-all ${selectedMoment === 'intro' ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-400' : 'border-l-4 border-transparent even:bg-white odd:bg-gray-50/50'}`}
                        onClick={() => setSelectedMoment(selectedMoment === 'intro' ? null : 'intro')}
                      >
                        <div className="w-1/6 flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-xs font-medium shadow-md">
                            00:00
                          </div>
                        </div>
                        <div className="w-1/6 flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-300 to-blue-400 flex items-center justify-center mr-2 shadow-sm text-white">
                            <span className="text-xs font-medium">S1</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">Speaker 1</span>
                        </div>
                        <div className="w-1/2 flex items-center">
                          <p className="text-sm text-gray-700">Hello and welcome to the demo of Cline, an AI autonomous coding agent for VS Code.</p>
                        </div>
                        <div className="w-1/6 flex items-center">
                          <span className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 rounded-full text-xs font-medium shadow-sm">Introduction</span>
                        </div>
                      </div>
                      
                      {/* Timeline moment - Question */}
                      <div 
                        className={`flex py-4 px-4 hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-purple-50/80 cursor-pointer transition-all ${selectedMoment === 'question' ? 'bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-purple-400' : 'border-l-4 border-transparent even:bg-white odd:bg-gray-50/50'}`}
                        onClick={() => setSelectedMoment(selectedMoment === 'question' ? null : 'question')}
                      >
                        <div className="w-1/6 flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium shadow-md">
                            00:01
                          </div>
                        </div>
                        <div className="w-1/6 flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-300 to-purple-400 flex items-center justify-center mr-2 shadow-sm text-white">
                            <span className="text-xs font-medium">S2</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">Speaker 2</span>
                        </div>
                        <div className="w-1/2 flex items-center">
                          <p className="text-sm text-gray-700">How does it integrate with our development workflow?</p>
                        </div>
                        <div className="w-1/6 flex items-center">
                          <span className="px-3 py-1.5 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-full text-xs font-medium shadow-sm">Question</span>
                        </div>
                      </div>
                      
                      {/* Timeline moment - Objection */}
                      <div 
                        className={`flex py-4 px-4 hover:bg-gradient-to-r hover:from-red-50/50 hover:to-red-50/80 cursor-pointer transition-all ${selectedMoment === 'objection' ? 'bg-gradient-to-r from-red-50 to-red-100 border-l-4 border-red-400' : 'border-l-4 border-transparent even:bg-white odd:bg-gray-50/50'}`}
                        onClick={() => setSelectedMoment(selectedMoment === 'objection' ? null : 'objection')}
                      >
                        <div className="w-1/6 flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-400 to-red-500 flex items-center justify-center text-white text-xs font-medium shadow-md">
                            00:01
                          </div>
                        </div>
                        <div className="w-1/6 flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-300 to-purple-400 flex items-center justify-center mr-2 shadow-sm text-white">
                            <span className="text-xs font-medium">S2</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">Speaker 2</span>
                        </div>
                        <div className="w-1/2 flex items-center">
                          <p className="text-sm text-gray-700">I'm concerned about potential pricing for large teams.</p>
                        </div>
                        <div className="w-1/6 flex items-center">
                          <span className="px-3 py-1.5 bg-gradient-to-r from-red-100 to-red-200 text-red-700 rounded-full text-xs font-medium shadow-sm">Objection</span>
                        </div>
                      </div>
                      
                      {/* Timeline moment - Decision */}
                      <div 
                        className={`flex py-4 px-4 hover:bg-gradient-to-r hover:from-green-50/50 hover:to-green-50/80 cursor-pointer transition-all ${selectedMoment === 'decision' ? 'bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-400' : 'border-l-4 border-transparent even:bg-white odd:bg-gray-50/50'}`}
                        onClick={() => setSelectedMoment(selectedMoment === 'decision' ? null : 'decision')}
                      >
                        <div className="w-1/6 flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-400 to-green-500 flex items-center justify-center text-white text-xs font-medium shadow-md">
                            00:02
                          </div>
                        </div>
                        <div className="w-1/6 flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-300 to-blue-400 flex items-center justify-center mr-2 shadow-sm text-white">
                            <span className="text-xs font-medium">S1</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">Speaker 1</span>
                        </div>
                        <div className="w-1/2 flex items-center">
                          <p className="text-sm text-gray-700">We've decided to proceed with a trial implementation for the development team.</p>
                        </div>
                        <div className="w-1/6 flex items-center">
                          <span className="px-3 py-1.5 bg-gradient-to-r from-green-100 to-green-200 text-green-700 rounded-full text-xs font-medium shadow-sm">Decision</span>
                        </div>
                      </div>
                      
                      {/* Timeline moment - Action Item */}
                      <div 
                        className={`flex py-4 px-4 hover:bg-gradient-to-r hover:from-amber-50/50 hover:to-amber-50/80 cursor-pointer transition-all ${selectedMoment === 'action' ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-l-4 border-amber-400' : 'border-l-4 border-transparent even:bg-white odd:bg-gray-50/50'}`}
                        onClick={() => setSelectedMoment(selectedMoment === 'action' ? null : 'action')}
                      >
                        <div className="w-1/6 flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white text-xs font-medium shadow-md">
                            00:03
                          </div>
                        </div>
                        <div className="w-1/6 flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-300 to-blue-400 flex items-center justify-center mr-2 shadow-sm text-white">
                            <span className="text-xs font-medium">S1</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">Speaker 1</span>
                        </div>
                        <div className="w-1/2 flex items-center">
                          <p className="text-sm text-gray-700">Let's schedule a follow-up meeting next week to discuss implementation details.</p>
                        </div>
                        <div className="w-1/6 flex items-center">
                          <span className="px-3 py-1.5 bg-gradient-to-r from-amber-100 to-amber-200 text-amber-700 rounded-full text-xs font-medium shadow-sm">Action Item</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Topic and sentiment timeline visualization with tooltips */}
                  <div className="mb-8">
                    <h4 className="text-sm font-medium mb-3">Topics & Sentiment Flow</h4>
                    <div className="relative h-24 rounded-xl overflow-hidden shadow-md bg-white group">
                      {/* Simplified topic segments with gradients and tooltips */}
                      <div className="absolute inset-0 flex">
                        <div 
                          className="w-1/4 h-full bg-gradient-to-r from-blue-100 to-blue-200 relative cursor-help transition-all hover:brightness-110" 
                          title="Topic: Introduction (00:00-00:01) - Initial welcome and product introduction"
                        >
                          <div className="absolute top-2 left-0 right-0 text-center">
                            <span className="px-2 py-1 bg-white/80 rounded-lg text-xs font-medium text-blue-700 shadow-sm">Introduction</span>
                          </div>
                          {/* Enhanced tooltip on hover */}
                          <div className="absolute inset-0 bg-blue-900/80 opacity-0 group-hover:opacity-0 hover:opacity-80 flex items-center justify-center transition-opacity duration-200">
                            <div className="text-white text-center px-2">
                              <p className="text-xs font-medium">Introduction</p>
                              <p className="text-xs">00:00-00:01</p>
                            </div>
                          </div>
                        </div>
                        <div 
                          className="w-1/4 h-full bg-gradient-to-r from-purple-100 to-purple-200 relative cursor-help transition-all hover:brightness-110"
                          title="Topic: Features (00:01-00:02) - Discussion of product capabilities and options"
                        >
                          <div className="absolute top-2 left-0 right-0 text-center">
                            <span className="px-2 py-1 bg-white/80 rounded-lg text-xs font-medium text-purple-700 shadow-sm">Features</span>
                          </div>
                          {/* Enhanced tooltip on hover */}
                          <div className="absolute inset-0 bg-purple-900/80 opacity-0 group-hover:opacity-0 hover:opacity-80 flex items-center justify-center transition-opacity duration-200">
                            <div className="text-white text-center px-2">
                              <p className="text-xs font-medium">Features</p>
                              <p className="text-xs">00:01-00:02</p>
                            </div>
                          </div>
                        </div>
                        <div 
                          className="w-1/4 h-full bg-gradient-to-r from-green-100 to-green-200 relative cursor-help transition-all hover:brightness-110"
                          title="Topic: Integration (00:02-00:03) - How the product integrates with existing systems"
                        >
                          <div className="absolute top-2 left-0 right-0 text-center">
                            <span className="px-2 py-1 bg-white/80 rounded-lg text-xs font-medium text-green-700 shadow-sm">Integration</span>
                          </div>
                          {/* Enhanced tooltip on hover */}
                          <div className="absolute inset-0 bg-green-900/80 opacity-0 group-hover:opacity-0 hover:opacity-80 flex items-center justify-center transition-opacity duration-200">
                            <div className="text-white text-center px-2">
                              <p className="text-xs font-medium">Integration</p>
                              <p className="text-xs">00:02-00:03</p>
                            </div>
                          </div>
                        </div>
                        <div 
                          className="w-1/4 h-full bg-gradient-to-r from-amber-100 to-amber-200 relative cursor-help transition-all hover:brightness-110"
                          title="Topic: Next Steps (00:03) - Action items and follow-up plans"
                        >
                          <div className="absolute top-2 left-0 right-0 text-center">
                            <span className="px-2 py-1 bg-white/80 rounded-lg text-xs font-medium text-amber-700 shadow-sm">Next Steps</span>
                          </div>
                          {/* Enhanced tooltip on hover */}
                          <div className="absolute inset-0 bg-amber-900/80 opacity-0 group-hover:opacity-0 hover:opacity-80 flex items-center justify-center transition-opacity duration-200">
                            <div className="text-white text-center px-2">
                              <p className="text-xs font-medium">Next Steps</p>
                              <p className="text-xs">00:03</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Key event markers with tooltips */}
                      <div className="absolute top-12 left-0 right-0 flex items-center px-4">
                        <div className="w-1/5 flex justify-center">
                          <div 
                            className="w-4 h-4 rounded-full bg-blue-400 border-2 border-white shadow-sm cursor-help relative hover:scale-125 transition-transform" 
                            title="Introduction (00:00): Hello and welcome to the demo of Cline"
                          >
                            <div className="absolute w-max p-1 bg-blue-800 text-white text-xs rounded opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none -translate-x-1/2 -translate-y-full -top-1 left-1/2">
                              Introduction (00:00)
                            </div>
                          </div>
                        </div>
                        <div className="w-2/5 flex justify-around">
                          <div 
                            className="w-4 h-4 rounded-full bg-purple-400 border-2 border-white shadow-sm cursor-help relative hover:scale-125 transition-transform" 
                            title="Question (00:01): How does it integrate with our development workflow?"
                          >
                            <div className="absolute w-max p-1 bg-purple-800 text-white text-xs rounded opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none -translate-x-1/2 -translate-y-full -top-1 left-1/2">
                              Question (00:01)
                            </div>
                          </div>
                          <div 
                            className="w-4 h-4 rounded-full bg-red-400 border-2 border-white shadow-sm cursor-help relative hover:scale-125 transition-transform" 
                            title="Objection (00:01): I'm concerned about potential pricing for large teams"
                          >
                            <div className="absolute w-max p-1 bg-red-800 text-white text-xs rounded opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none -translate-x-1/2 -translate-y-full -top-1 left-1/2">
                              Objection (00:01)
                            </div>
                          </div>
                        </div>
                        <div className="w-1/5 flex justify-center">
                          <div 
                            className="w-4 h-4 rounded-full bg-green-400 border-2 border-white shadow-sm cursor-help relative hover:scale-125 transition-transform" 
                            title="Decision (00:02): We've decided to proceed with a trial implementation"
                          >
                            <div className="absolute w-max p-1 bg-green-800 text-white text-xs rounded opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none -translate-x-1/2 -translate-y-full -top-1 left-1/2">
                              Decision (00:02)
                            </div>
                          </div>
                        </div>
                        <div className="w-1/5 flex justify-center">
                          <div 
                            className="w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-sm cursor-help relative hover:scale-125 transition-transform" 
                            title="Action Item (00:03): Schedule follow-up meeting next week"
                          >
                            <div className="absolute w-max p-1 bg-amber-800 text-white text-xs rounded opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none -translate-x-1/2 -translate-y-full -top-1 left-1/2">
                              Action Item (00:03)
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Sentiment indicator bar with tooltips */}
                      <div className="absolute bottom-0 left-0 right-0 h-3 flex">
                        <div 
                          className="w-1/5 h-full bg-green-400 opacity-70 cursor-help"
                          title="Positive sentiment (00:00-00:00.6): Speaker showing enthusiasm"
                        >
                          <div className="absolute bottom-full left-0 right-0 text-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-xs bg-white/80 px-1 rounded text-green-700">Very Positive</span>
                          </div>
                        </div>
                        <div 
                          className="w-1/5 h-full bg-green-500 opacity-70 cursor-help"
                          title="Positive sentiment (00:00.6-00:01.2): Strong positive reception"
                        >
                          <div className="absolute bottom-full left-0 right-0 text-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-xs bg-white/80 px-1 rounded text-green-700">Positive</span>
                          </div>
                        </div>
                        <div 
                          className="w-1/5 h-full bg-yellow-400 opacity-70 cursor-help"
                          title="Neutral sentiment (00:01.2-00:01.8): Questions and concerns raised"
                        >
                          <div className="absolute bottom-full left-0 right-0 text-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-xs bg-white/80 px-1 rounded text-yellow-700">Neutral</span>
                          </div>
                        </div>
                        <div 
                          className="w-1/5 h-full bg-green-400 opacity-70 cursor-help"
                          title="Positive sentiment (00:01.8-00:02.4): Return to positive mood after addressing concerns"
                        >
                          <div className="absolute bottom-full left-0 right-0 text-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-xs bg-white/80 px-1 rounded text-green-700">Positive</span>
                          </div>
                        </div>
                        <div 
                          className="w-1/5 h-full bg-green-500 opacity-70 cursor-help"
                          title="Very positive sentiment (00:02.4-00:03): Enthusiastic about next steps"
                        >
                          <div className="absolute bottom-full left-0 right-0 text-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-xs bg-white/80 px-1 rounded text-green-700">Very Positive</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Time markers */}
                      <div className="absolute bottom-6 left-0 right-0 flex justify-between px-4">
                        <div className="text-xs font-medium text-gray-600">00:00</div>
                        <div className="text-xs font-medium text-gray-600">00:03</div>
                      </div>
                      
                      {/* Legend tooltip button */}
                      <div className="absolute top-1 right-1 z-10">
                        <div className="group relative">
                          <button className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs hover:bg-gray-300">?</button>
                          <div className="absolute right-0 top-full mt-1 w-48 p-2 bg-white rounded-md shadow-lg border border-gray-200 hidden group-hover:block">
                            <div className="text-xs">
                              <p className="font-medium mb-1">Timeline Legend:</p>
                              <div className="flex items-center mb-1">
                                <div className="w-2 h-2 bg-blue-200 mr-1"></div>
                                <span>Topic segments</span>
                              </div>
                              <div className="flex items-center mb-1">
                                <div className="w-2 h-2 rounded-full bg-blue-400 mr-1"></div>
                                <span>Key moments</span>
                              </div>
                              <div className="flex items-center">
                                <div className="w-2 h-2 bg-green-400 mr-1"></div>
                                <span>Sentiment indicators</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Playhead */}
                      <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500 shadow-sm" style={{ 
                        left: `${(currentTime/3)*100}%`
                      }}></div>
                    </div>
                  </div>
                  
                  {/* Details panel for selected moment - Enhanced with card design */}
                  {selectedMoment && (
                    <div className="mb-8 p-6 border border-gray-200 rounded-xl bg-white shadow-lg relative overflow-hidden">
                      {/* Decorative accent */}
                      <div className={`absolute top-0 left-0 w-full h-1 ${
                        selectedMoment === 'intro' ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
                        selectedMoment === 'question' ? 'bg-gradient-to-r from-purple-400 to-purple-500' :
                        selectedMoment === 'objection' ? 'bg-gradient-to-r from-red-400 to-red-500' :
                        selectedMoment === 'decision' ? 'bg-gradient-to-r from-green-400 to-green-500' :
                        'bg-gradient-to-r from-amber-400 to-amber-500'
                      }`}></div>
                      
                      {/* Background pattern */}
                      <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden">
                        <svg className="absolute right-0 top-0 h-64 w-64 text-gray-400 transform translate-x-1/3 -translate-y-1/4" fill="currentColor" viewBox="0 0 200 200">
                          <path d="M0,0 C40,80 80,0 120,80 C160,160 200,80 200,200 L0,200 Z" />
                        </svg>
                      </div>
                      
                      <div className="flex justify-between items-center mb-4 relative z-10">
                        <h4 className="font-medium text-lg">Moment Details</h4>
                        <button className="text-gray-400 hover:text-gray-600 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm transition-all hover:shadow hover:scale-110" onClick={() => setSelectedMoment(null)}>
                          <X size={14} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-6 relative z-10">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Time</p>
                          <p className="text-sm font-medium">{selectedMoment === 'intro' ? '00:00' : selectedMoment === 'action' ? '00:03' : selectedMoment === 'decision' ? '00:02' : '00:01'}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Speaker</p>
                          <p className="text-sm font-medium">{selectedMoment === 'question' || selectedMoment === 'objection' ? 'Speaker 2' : 'Speaker 1'}</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">Type</p>
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            selectedMoment === 'intro' ? 'bg-blue-100 text-blue-700' :
                            selectedMoment === 'question' ? 'bg-purple-100 text-purple-700' :
                            selectedMoment === 'objection' ? 'bg-red-100 text-red-700' :
                            selectedMoment === 'decision' ? 'bg-green-100 text-green-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {selectedMoment === 'intro' ? 'Introduction' : 
                             selectedMoment === 'question' ? 'Question' : 
                             selectedMoment === 'objection' ? 'Objection' : 
                             selectedMoment === 'decision' ? 'Decision' : 'Action Item'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-6 relative z-10">
                        <p className="text-xs text-gray-500 mb-2">Content</p>
                        <div className="text-sm text-gray-700 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow-inner">
                          <p className="relative">
                            {selectedMoment === 'intro' ? 'Hello and welcome to the demo of Cline, an AI autonomous coding agent for VS Code.' : 
                             selectedMoment === 'question' ? 'How does it integrate with our development workflow?' : 
                             selectedMoment === 'objection' ? 'I\'m concerned about potential pricing for large teams.' : 
                             selectedMoment === 'decision' ? 'We\'ve decided to proceed with a trial implementation for the development team.' : 
                             'Let\'s schedule a follow-up meeting next week to discuss implementation details.'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Enhanced action tools with visual flair */}
                      <div className="flex flex-wrap gap-2 mb-6 relative z-10">
                        <button className="px-3 py-1.5 text-xs bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-blue-600 rounded-full flex items-center gap-1 shadow-sm transition-all hover:shadow">
                          <Play size={12} className="text-blue-500" />
                          <span>Play Segment</span>
                        </button>
                        <button className="px-3 py-1.5 text-xs bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 text-cyan-600 rounded-full flex items-center gap-1 shadow-sm transition-all hover:shadow">
                          <Mail size={12} className="text-cyan-500" />
                          <span>Email</span>
                        </button>
                        <button className="px-3 py-1.5 text-xs bg-gradient-to-r from-emerald-50 to-green-50 hover:from-emerald-100 hover:to-green-100 text-green-600 rounded-full flex items-center gap-1 shadow-sm transition-all hover:shadow">
                          <Calendar size={12} className="text-green-500" />
                          <span>Add to Calendar</span>
                        </button>
                        <button className="px-3 py-1.5 text-xs bg-gradient-to-r from-amber-50 to-yellow-50 hover:from-amber-100 hover:to-yellow-100 text-amber-600 rounded-full flex items-center gap-1 shadow-sm transition-all hover:shadow">
                          <List size={12} className="text-amber-500" />
                          <span>Create Task</span>
                        </button>
                        <button className="px-3 py-1.5 text-xs bg-gradient-to-r from-fuchsia-50 to-purple-50 hover:from-fuchsia-100 hover:to-purple-100 text-purple-600 rounded-full flex items-center gap-1 shadow-sm transition-all hover:shadow">
                          <MessageCircle size={12} className="text-purple-500" />
                          <span>Comment</span>
                        </button>
                      </div>
                      
                      {/* Comments section with enhanced styling */}
                      <div className="pt-4 border-t border-gray-200 relative z-10">
                        <h5 className="text-sm font-medium mb-4 flex items-center">
                          <MessageCircle size={14} className="mr-1 text-indigo-500" />
                          <span>Comments</span>
                        </h5>
                        
                        {selectedMoment === 'action' && (
                          <div className="mb-3 p-3 bg-gradient-to-r from-gray-50 to-indigo-50/30 rounded-lg">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                <span className="text-xs font-medium text-white">JD</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-800">John Doe</span>
                                  <span className="text-xs text-gray-500">Today, 12:34 PM</span>
                                </div>
                                <p className="text-sm text-gray-700">I'll schedule this for next Tuesday at 10 AM. @Sarah please prepare the integration docs.</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Comment input with enhanced design */}
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <span className="text-xs font-medium text-white">ME</span>
                          </div>
                          <div className="flex-grow relative">
                            <input 
                              type="text" 
                              value={commentInput}
                              onChange={(e) => setCommentInput(e.target.value)}
                              placeholder="Add a comment..." 
                              className="w-full py-2 px-4 pr-10 border border-gray-300 rounded-full text-sm shadow-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-300 focus:outline-none transition-all"
                            />
                            <button className="absolute right-3 top-2 text-blue-500 hover:text-blue-600 transition-colors">
                              <Send size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecordingDetails;