import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ThemeProvider } from './theme/ThemeContext';
import { ToastProvider } from './components/Toast';
import { I18nProvider } from './i18n';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  </React.StrictMode>
);
