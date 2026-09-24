import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

// Sanitiza el payload del usuario antes de persistirlo en localStorage para
// evitar "Browser Storage Poisoning" (S8475): solo se admiten campos conocidos
// con tipos esperados; cualquier otro contenido se descarta.
const sanitizeUser = (data) => {
  if (!data || typeof data !== 'object') return null;
  const user = {};
  for (const key of ['id', 'username', 'email', 'role', 'tokens', 'email_verified', 'verification_code', 'verificationCode']) {
    if (key in data) user[key] = data[key];
  }
  if (!('id' in user)) return null;
  return user;
};

const persistUser = (data) => {
  const safe = sanitizeUser(data);
  if (safe === null) return false;
  localStorage.setItem('od_user', JSON.stringify(safe));
  return true;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modo, setModo] = useState('artista');
  // Indica si ya se restauró la sesión desde localStorage (previene
  // redirección falsa a /login durante el primer render).
  const [initialized, setInitialized] = useState(false);

  // Inicializar sesión desde localStorage (solo el token, no datos sensibles)
  const initFromStorage = useCallback(() => {
    const storedToken = localStorage.getItem('od_token');
    const storedUser = localStorage.getItem('od_user');

    if (storedToken && storedUser) {
      try {
        const safe = sanitizeUser(JSON.parse(storedUser));
        if (safe) {
          setToken(storedToken);
          setUser(safe);
        } else {
          throw new Error('Usuario almacenado no válido');
        }
      } catch (err) {
        // Token corrupto, limpiar
        localStorage.removeItem('od_token');
        localStorage.removeItem('od_user');
      }
    }
    setInitialized(true);
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
      persistUser(userData);
      
      return { success: true }; // login
    } catch (error) {
      return {
        success: false,
        message:
          error.response?.data?.errors?.[0]?.msg ||
          error.response?.data?.error ||
          'Error al iniciar sesión'
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
      persistUser(user);
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message:
          error.response?.data?.errors?.[0]?.msg ||
          error.response?.data?.error ||
          'Error al registrarse'
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

  // Verifica el email del usuario autenticado con el código de 6 dígitos.
  const verifyEmail = useCallback(async (code) => {
    try {
      const res = await api.post('/api/auth/verify', { code });
      const current = JSON.parse(localStorage.getItem('od_user') || '{}');
      const updated = sanitizeUser({ ...current, ...res.data.user });
      if (updated) {
        setUser(updated);
        localStorage.setItem('od_user', JSON.stringify(updated));
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message:
          error.response?.data?.errors?.[0]?.msg ||
          error.response?.data?.error ||
          'No se pudo verificar el correo'
      };
    }
  }, []);

  // Alternar entre modo Artista y Curador
  const toggleModo = useCallback(() => {
    setModo((prev) => (prev === 'artista' ? 'curador' : 'artista'));
  }, []);

  // Refresca los datos del usuario desde la BD (mantiene el contador de
  // tokens sincronizado tras enviar/aceptar propuestas).
  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/me');
      const safe = sanitizeUser(res.data.user);
      if (safe) {
        setUser(safe);
        localStorage.setItem('od_user', JSON.stringify(safe));
      }
    } catch (err) {
      // Token expirado o red caída; se mantiene el valor previo en memoria.
    }
  }, []);

  const value = {
    user,
    token,
    loading,
    modo,
    initialized,
    login,
    register,
    logout,
    verifyEmail,
    toggleModo,
    refreshUser,
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
