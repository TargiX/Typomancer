import React from 'react';
import ReactDOM from 'react-dom/client';
import { initBotId } from 'botid/client/core';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { CloudProgressProvider } from './components/CloudProgress';
import { initErrorReporting } from './services/errorReporting';

// Recovery URLs carry a short-lived credential: do not initialize telemetry or
// third-party challenge scripts on this dedicated screen.
const isPasswordRecovery = new URLSearchParams(location.search).has('reset-password');
if (!isPasswordRecovery) initErrorReporting();

if (import.meta.env.PROD && !isPasswordRecovery) {
  initBotId({
    protect: [{ path: '/api/gemini', method: 'POST' }]
  });
  // The app shell works offline through the local campaign; register the SW
  // only in prod so dev HMR never fights a cache.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <CloudProgressProvider><App /></CloudProgressProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
