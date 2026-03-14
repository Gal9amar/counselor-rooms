import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// PWA install prompt — store event for later use
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
  // Show install banner after 3 seconds if not dismissed
  setTimeout(() => {
    if (window.__installPrompt) {
      window.__installPrompt.prompt();
    }
  }, 3000);
});
