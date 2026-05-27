import React from 'react';
import ReactDOM from 'react-dom/client';
import { LandingPage } from './LandingPage';
import '../index.css';

ReactDOM.createRoot(document.getElementById('landing-root')!).render(
  <React.StrictMode>
    <LandingPage />
  </React.StrictMode>,
);
