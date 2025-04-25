import React from 'react';
import { createRoot } from 'react-dom/client';
import RecordingDetails from './RecordingDetails';
import './index.css'; // Import the base Tailwind CSS file
// import './style.css'; // Import CSS if you have a main style file

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <RecordingDetails />
      </React.StrictMode>
    );
  } else {
    console.error('Target container #root not found');
  }
}); 