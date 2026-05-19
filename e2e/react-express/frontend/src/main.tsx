// Load OTel BEFORE any other application import so the SDK is initialized
// before any code that we want to be traced runs.
import './otel';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
