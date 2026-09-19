import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { getInitialTheme, applyTheme } from './components/ThemeToggle.jsx';
import './index.css';

// Aplicar el tema antes del primer render (evita parpadeo de tema)
applyTheme(getInitialTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
