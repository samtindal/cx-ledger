import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LedgerProvider, UiProvider } from './state/store';
import './styles/tokens.css';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LedgerProvider>
      <UiProvider>
        <App />
      </UiProvider>
    </LedgerProvider>
  </React.StrictMode>,
);
