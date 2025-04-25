import React, { useState } from 'react';
import { Search, Filter, Download, Share2, X, MessageCircle, MessageSquare, CheckCircle, AlertCircle, List } from 'lucide-react';

// Use consistent Material-style button component (could be moved to a separate file)
const MaterialButton = ({ children, onClick, variant = 'text', color = 'default', className = '', ...props }) => {
  const baseStyle = "px-3 py-1.5 rounded text-sm font-medium transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1";
  let variantStyle = '';
  let colorStyle = '';

  switch (variant) {
    case 'contained':
      variantStyle = 'shadow hover:shadow-md';
      break;
    case 'outlined':
      variantStyle = 'border';
      break;
    case 'text': // Default
    default:
      variantStyle = 'hover:bg-gray-100';
      break;
  }

  switch (color) {
    case 'primary':
      colorStyle = variant === 'contained' 
        ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-300' 
        : variant === 'outlined'
        ? 'border-blue-500 text-blue-600 hover:bg-blue-50 focus:ring-blue-300'
        : 'text-blue-600 hover:bg-blue-50 focus:ring-blue-300';
      break;
    case 'secondary':
      colorStyle = variant === 'contained' 
        ? 'bg-gray-700 text-white hover:bg-gray-800 focus:ring-gray-400' 
        : variant === 'outlined'
        ? 'border-gray-500 text-gray-700 hover:bg-gray-100 focus:ring-gray-400'
        : 'text-gray-700 hover:bg-gray-100 focus:ring-gray-400';
      break;
    default: // Default color (like a standard button)
      colorStyle = variant === 'contained' 
        ? 'bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-300' 
        : variant === 'outlined'
        ? 'border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300'
        : 'text-gray-700 hover:bg-gray-100 focus:ring-gray-300';
      break;
  }

  return (
    <button 
      onClick={onClick}
      className={`${baseStyle} ${variantStyle} ${colorStyle} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

// Natural language search examples for the tooltip
const searchExamples = [
  "who mentioned pricing",
  "what decisions were made",
  "when did John talk about the deadline",
  "action items from Sarah",
  "questions about the budget"
];

// Function to process natural language search
const processNaturalLanguageSearch = (query) => {
  // Convert query to lowercase for case-insensitive matching
  const lowercaseQuery = query.toLowerCase();
  
  // Define patterns to detect question type queries
  const questionPattern = /^(who|what|when|where|why|how).+/i;
  const speakerPattern = /(from|by)\s+(\w+)/i;
  const typePatterns = {
    decision: /(decisions|decision|decided|agreed)/i,
    question: /(questions|question|asked|inquired)/i,
    action: /(action items|tasks|todo|to do|action)/i,
    objection: /(objections|concerns|objected|disagreed)/i,
  };
  
  // Detect if this is a specific type of search
  if (questionPattern.test(lowercaseQuery)) {
    // Handle who/what/when/where/why/how questions
    return {
      originalQuery: query,
      type: 'question',
      structuredFilters: {}
    };
  }
  
  // Check for speaker filters
  const speakerMatch = lowercaseQuery.match(speakerPattern);
  let speaker = null;
  if (speakerMatch && speakerMatch[2]) {
    speaker = speakerMatch[2];
  }
  
  // Check for content type filters
  let contentType = null;
  for (const [type, pattern] of Object.entries(typePatterns)) {
    if (pattern.test(lowercaseQuery)) {
      contentType = type;
      break;
    }
  }
  
  // Return structured result
  return {
    originalQuery: query,
    type: 'structured',
    structuredFilters: {
      speaker: speaker,
      contentType: contentType
    }
  };
};

const SearchAndFilterControls = ({ 
  timelineSearch, 
  onSearchChange, 
  activeFilters, 
  onFilterChange, 
  onExport, // Assuming these are passed from parent 
  onShare   // Assuming these are passed from parent
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showSearchHelp, setShowSearchHelp] = useState(false);
  const [processedSearch, setProcessedSearch] = useState(null);

  // Define filter types (adjust as needed based on your actual moment types)
  const filterTypes = [
    { key: 'question', label: 'Questions', icon: MessageCircle },
    { key: 'decision', label: 'Decisions', icon: CheckCircle },
    { key: 'action', label: 'Action Items', icon: List },
    { key: 'objection', label: 'Objections', icon: AlertCircle },
    // Add other types like 'feedback', 'info', etc.
  ];

  const handleToggleAllFilters = () => {
    const allChecked = !activeFilters.all;
    const newFilters = { ...activeFilters, all: allChecked };
    filterTypes.forEach(ft => {
      newFilters[ft.key] = allChecked;
    });
    onFilterChange(newFilters); // Call parent handler with the complete new state
  };

  const handleIndividualFilterChange = (key) => {
    const newFilters = {
      ...activeFilters,
      [key]: !activeFilters[key],
    };
    // Check if all individual filters are now checked/unchecked
    const allIndividualChecked = filterTypes.every(ft => newFilters[ft.key]);
    newFilters.all = allIndividualChecked;
    onFilterChange(newFilters); // Call parent handler
  };

  // Process search input for natural language queries
  const handleSearchChange = (e) => {
    const query = e.target.value;
    
    // Update the original search input
    if (onSearchChange) {
      onSearchChange(e);
    }
    
    // Process natural language query if it's complex enough
    if (query.length > 3) {
      const processed = processNaturalLanguageSearch(query);
      setProcessedSearch(processed);
      
      // Automatically apply filters based on the query
      if (processed.structuredFilters.contentType && !activeFilters.all) {
        const contentType = processed.structuredFilters.contentType;
        const newFilters = { ...activeFilters };
        
        // Reset all type filters first
        filterTypes.forEach(ft => {
          newFilters[ft.key] = false;
        });
        
        // Set the detected type to true
        if (newFilters[contentType] !== undefined) {
          newFilters[contentType] = true;
        }
        
        onFilterChange(newFilters);
      }
    } else {
      setProcessedSearch(null);
    }
  };

  // Helper for export/share if needed (or use props directly)
  const handleExport = () => {
    console.log("Export action triggered");
    if (onExport) onExport(); // Call parent export function if provided
    else alert("Export function not implemented.")
  };
  
  const handleShare = (type) => {
    console.log(`Share action triggered: ${type}`);
    if (onShare) onShare(type); // Call parent share function if provided
    else alert(`Share function (${type}) not implemented.`);
    setShowShare(false); // Close dropdown after action
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 my-4 items-center">
      {/* Search Input with Natural Language Support */}
      <div className="relative flex-grow w-full md:w-auto">
        <input 
          type="text" 
          value={timelineSearch}
          onChange={handleSearchChange} 
          onFocus={() => setShowSearchHelp(true)}
          onBlur={() => setTimeout(() => setShowSearchHelp(false), 200)}
          placeholder="Search timeline or try 'who mentioned pricing'..." 
          className="w-full py-2 px-3 pr-10 border border-gray-300 rounded-md text-sm bg-white shadow-sm 
                     focus:ring-2 focus:ring-blue-300 focus:border-blue-500 focus:outline-none transition duration-150 ease-in-out"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Search size={18} />
        </span>
        
        {/* Search examples tooltip */}
        {showSearchHelp && (
          <div className="absolute z-30 left-0 mt-1 bg-white shadow-lg rounded-md w-full border border-gray-200 p-2">
            <p className="text-xs text-gray-500 mb-1">Try natural language queries like:</p>
            <ul className="space-y-1">
              {searchExamples.map((example, index) => (
                <li 
                  key={index} 
                  className="text-xs text-blue-600 hover:bg-blue-50 rounded px-2 py-1 cursor-pointer"
                  onClick={() => {
                    const syntheticEvent = { target: { value: example } };
                    handleSearchChange(syntheticEvent);
                  }}
                >
                  {example}
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Show active search analysis/interpretation */}
        {processedSearch && (
          <div className="mt-2 text-xs text-gray-600 bg-blue-50 p-2 rounded-md">
            <span className="font-medium">Interpreting:</span> 
            {processedSearch.structuredFilters.speaker && (
              <span className="px-1 py-0.5 rounded bg-blue-100 text-blue-700 ml-1 mr-1">
                Speaker: {processedSearch.structuredFilters.speaker}
              </span>
            )}
            {processedSearch.structuredFilters.contentType && (
              <span className="px-1 py-0.5 rounded bg-green-100 text-green-700 ml-1 mr-1">
                Type: {processedSearch.structuredFilters.contentType}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Action Buttons Area */}
      <div className="flex gap-2 flex-shrink-0">
        {/* Filter Button & Dropdown */}
        <div className="relative">
          <MaterialButton 
            onClick={() => setShowFilters(!showFilters)}
            variant="outlined"
            aria-haspopup="true"
            aria-expanded={showFilters}
          >
            <Filter size={16} className="mr-1" />
            Filters
          </MaterialButton>
          {showFilters && (
            // Material Menu like dropdown
            <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-md py-1 z-30 w-56 border border-gray-200 animate-fade-in-fast">
              <div className="flex justify-between items-center px-3 pt-2 pb-1 mb-1 border-b border-gray-100">
                 <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filter by Type</span>
                 <button onClick={() => setShowFilters(false)} className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={14}/></button>
              </div>
              <div className="px-2 py-1 space-y-1">
                {/* Filter options styled as list items */}
                <label className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md transition-colors cursor-pointer hover:bg-gray-100">
                  <input 
                    type="checkbox" 
                    checked={activeFilters.all || false}
                    onChange={handleToggleAllFilters}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300"
                  />
                  <span className="font-medium text-gray-700">All Types</span>
                </label>
                <hr className="my-1 border-gray-100"/>
                {filterTypes.map((filter) => {
                  const FilterIcon = filter.icon;
                  return (
                    <label key={filter.key} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-md transition-colors cursor-pointer hover:bg-gray-100">
                      <input 
                        type="checkbox" 
                        checked={activeFilters[filter.key] || false} 
                        onChange={() => handleIndividualFilterChange(filter.key)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300"
                        disabled={activeFilters.all}
                      />
                      {FilterIcon && <FilterIcon size={14} className="text-gray-500" />}
                      <span className="text-gray-700">{filter.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Export Button */}
        <MaterialButton 
          onClick={handleExport} // Use internal handler or prop
          variant="outlined"
        >
          <Download size={16} className="mr-1" />
          Export
        </MaterialButton>
        
        {/* Share Button & Dropdown */}
        <div className="relative">
          <MaterialButton 
            onClick={() => setShowShare(!showShare)}
            variant="outlined"
            aria-haspopup="true"
            aria-expanded={showShare}
          >
            <Share2 size={16} className="mr-1" />
            Share
          </MaterialButton>
          {showShare && (
            // Material Menu like dropdown
            <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-md py-1 z-30 w-52 border border-gray-200 animate-fade-in-fast">
             {/* No explicit close button needed, click action closes */}
              <button 
                onClick={() => handleShare('clipboard')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Copy Summary to Clipboard
              </button>
              <button 
                onClick={() => handleShare('email')}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Create Email Draft
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchAndFilterControls; 