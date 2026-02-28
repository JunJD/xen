import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/chrome-extension';
import App from './App.tsx';
import './style.css';
import { getClerkPublishableKey, getExtensionPopupUrl } from '@/lib/auth/clerk';

const publishableKey = getClerkPublishableKey();
const popupUrl = getExtensionPopupUrl();

const app = <App clerkEnabled={publishableKey.length > 0} />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {publishableKey
      ? (
        <ClerkProvider
          publishableKey={publishableKey}
          signInFallbackRedirectUrl={popupUrl}
          signUpFallbackRedirectUrl={popupUrl}
          afterSignOutUrl={popupUrl}
        >
          {app}
        </ClerkProvider>
      )
      : app}
  </React.StrictMode>,
);
