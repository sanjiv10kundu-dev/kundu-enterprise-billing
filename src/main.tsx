import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

try {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    registerSW({
      immediate: true,
      onRegisterError() {
        // Ignore service worker registration errors in restricted or private contexts
      },
    });
  }
} catch {
  // Never allow PWA registration issues to crash app startup
}
