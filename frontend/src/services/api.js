import axios from 'axios';

// Instancia central de axios con la URL base del backend
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor: agrega el token JWT a cada petición
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('od_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: manejo global de errores 401 (token expirado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('od_token');
      localStorage.removeItem('od_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
