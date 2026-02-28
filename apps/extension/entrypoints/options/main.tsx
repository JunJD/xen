import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import {
  requireClerkPublishableKey,
  requireClerkSyncHost,
} from '@/lib/auth/clerk';

requireClerkPublishableKey();
requireClerkSyncHost();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
