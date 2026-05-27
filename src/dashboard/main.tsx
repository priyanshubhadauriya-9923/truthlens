import React from 'react';
import ReactDOM from 'react-dom/client';
import DashboardApp from './DashboardApp';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import '../index.css';

ReactDOM.createRoot(document.getElementById('dashboard-root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DashboardApp />
    </ErrorBoundary>
  </React.StrictMode>,
);
