import React from 'react';
import ReactDOM from 'react-dom/client';

// file is named "Apps.tsx"
import App from './Apps';

// styles.css is at the project root (one level up from /src)
import '../styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
