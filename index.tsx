import React from 'react';
import ReactDOM from 'react-dom/client';
import { initBotId } from 'botid/client/core';
import App from './App';

initBotId({
  protect: [{ path: '/api/gemini', method: 'POST' }]
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
