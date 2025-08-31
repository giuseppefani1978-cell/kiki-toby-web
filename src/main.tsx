import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './Apps'; // ← ou renomme le fichier en App.tsx et importe './App'
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
