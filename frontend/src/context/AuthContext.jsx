import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState('artista');

  // Inicializar sesión desde localStorage (solo el token, no datos sensibles)
  const initFromStorage = useCallback(() => {
    const storedToken = localStorage.getItem('od_token');
    const storedUser = localStorage.getItem('od_user');
    
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (err) {
        // Token corrupto, limpiar
        localStorage.removeItem('od_token');
        localStorage.removeItem('od_user');
      }
    }
  }, []);

  // Login: recibe el JWT y lo almacena
  const login = async (credentials) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/login', credentials);
      const { token: jwtToken, user: userData } = response.data;
      
      setToken(jwtToken);
      setUser(userData);
      
      // Guardar en localStorage (persistencia de sesión)
      localStorage.setItem('od_token', jwtToken);
      localStorage.setItem('od_user', JSON.stringify(userData));
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || 'Error al iniciar sesión'
      };
    } finally {
      setLoading(false);
    }
  };

  // Registro: crea usuario y guarda sesión
  const register = async (userData) => {
    setLoading(true);
    try {
      const response = await api.post('/api/auth/register', userData);
      const { token: jwtToken, user } = response.data;
      
      setToken(jwtToken);
      setUser(user);
      
      localStorage.setItem('od_token', jwtToken);
      localStorage.setItem('od_user', JSON.stringify(user));
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || 'Error al registrarse'
      };
    } finally {
      setLoading(false);
    }
  };

  // Logout seguro: elimina token y datos
  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('od_token');
    localStorage.removeItem('od_user');
  }, []);

  // Alternar entre modo Artista y Curador
  const toggleModo = useCallback(() => {
    setModo((prev) => (prev === 'artista' ? 'curador' : 'artista'));
  }, []);

  const value = {
    user,
    token,
    loading,
    modo,
    login,
    register,
    logout,
    toggleModo,
    initFromStorage
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};
