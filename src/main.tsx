import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LedgerProvider, UiProvider, registerResetHook } from './state/store';
import { clearBlobs } from './docs/store';
import './styles/tokens.css';
import './styles/app.css';

registerResetHook(clearBlobs);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LedgerProvider>
      <UiProvider>
        <App />
      </UiProvider>
    </LedgerProvider>
  </React.StrictMode>,
);
