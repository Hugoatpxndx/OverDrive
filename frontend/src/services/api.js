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

// Interceptor: manejo global de errores 401 (token expirado/sesion inválida)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    const isRegisterRequest = error.config?.url?.includes('/auth/register');

    // Solo redirigir a login si es por token expirado y NO es un intento de
    // autenticación (esos no tienen token aún y su 401 debe mostrarse en el form).
    if (error.response?.status === 401 && !isLoginRequest && !isRegisterRequest) {
      localStorage.removeItem('od_token');
      localStorage.removeItem('od_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
