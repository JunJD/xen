import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './style.css';
import {
  requireClerkPublishableKey,
  requireClerkSyncHost,
} from '@/lib/auth/clerk';

requireClerkPublishableKey();
requireClerkSyncHost();

const app = <App />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {app}
  </React.StrictMode>,
);
