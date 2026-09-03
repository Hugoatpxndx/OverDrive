/**
 * Pruebas unitarias de Autenticación OverDrive
 * - Registro de usuarios (éxito y errores)
 * - Login (éxito y errores)
 * - Control de roles (JWT, isAdmin)
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret_secure';
process.env.JWT_EXPIRES_IN = '1h';

// Estado simulado de la base de datos para los tests
const dbState = {
  users: [],
  nextId: 1
};

jest.mock('../config/db', () => {
  return {
    executeQuery: jest.fn(async (sql, params) => {
      if (sql.includes('SELECT id, username, email, password_hash, role, tokens FROM users')) {
        return dbState.users.filter(
          (u) => u.email === params[0] || u.username === params[0]
        );
      }
      if (sql.includes('SELECT id FROM users')) {
        return dbState.users.filter(
          (u) => u.username === params[0] || u.email === params[0] ||
                 u.email === params[1]
        );
      }
      if (sql.includes('INSERT INTO users')) {
        const user = {
          id: dbState.nextId++,
          username: params[0],
          email: params[1],
          password_hash: params[2],
          role: params[3],
          tokens: params[4]
        };
        dbState.users.push(user);
        return { insertId: user.id, affectedRows: 1 };
      }
      return [];
    }),
    getConnection: jest.fn(async () => ({
      execute: jest.fn(async () => [[]]),
      release: jest.fn()
    })),
    pool: { getConnection: jest.fn() }
  };
});

const app = require('../server');

beforeEach(() => {
  dbState.users = [];
  dbState.nextId = 1;
});

describe('Autenticación OverDrive', () => {
  describe('POST /api/auth/register', () => {
    test('Debe registrar un nuevo usuario con bono de 3 tokens', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'artist_prueba',
          email: 'artist@test.com',
          password: 'Password123'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Usuario registrado exitosamente');
      expect(response.body.user.role).toBe('usuario');
      expect(response.body.user.tokens).toBe(3);
      expect(response.body.user.id).toBe(1);
      expect(response.body.token).toBeDefined();
    });

    test('Debe rechazar registro con email inválido', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'usuario_mal',
          email: 'email-no-valid',
          password: 'Password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('Debe rechazar contraseña débil (menos de 8 caracteres)', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'debil123',
          email: 'debil@test.com',
          password: '123'
        });

      expect(response.status).toBe(400);
    });

    test('Debe rechazar contraseña sin mayúscula/número', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'complejo',
          email: 'complejo@test.com',
          password: 'sololetrasminusculas'
        });

      expect(response.status).toBe(400);
    });

    test('Debe rechazar username con caracteres no permitidos', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'nombre!raro',
          email: 'raro@test.com',
          password: 'Password123'
        });

      expect(response.status).toBe(400);
    });

    test('Debe rechazar usuario duplicado (conflicto 409)', async () => {
      // Primer registro exitoso
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'duplicado',
          email: 'dup@test.com',
          password: 'Password123'
        });

      // Segundo registro con el mismo usuario
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'duplicado',
          email: 'dup2@test.com',
          password: 'Password123'
        });

      expect(response.status).toBe(409);
    });

    test('Debe rechazar registro con email ya existente (conflicto 409)', async () => {
      // Primer registro exitoso con email propio
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'email_original',
          email: 'reuso@test.com',
          password: 'Password123'
        });

      // Segundo registro con usuario distinto pero MISMO email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'usuario_nuevo',
          email: 'reuso@test.com',
          password: 'Password123'
        });

      expect(response.status).toBe(409);
    });

    test('Debe rechazar formulario vacío', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: '',
          email: '',
          password: ''
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Crear un usuario con la contraseña 'Password123' (hash con bcrypt)
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'login_user',
          email: 'login@test.com',
          password: 'Password123'
        });
    });

    test('Debe iniciar sesión con credenciales válidas por email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'login@test.com', password: 'Password123' });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.username).toBe('login_user');
      expect(response.body.user.role).toBe('usuario');
    });

    test('Debe iniciar sesión con credenciales válidas por username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'login_user', password: 'Password123' });

      expect(response.status).toBe(200);
    });

    test('Debe rechazar credenciales inválidas (usuario no existe)', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'no_existe', password: 'Password123' });

      expect(response.status).toBe(401);
    });

    test('Debe rechazar contraseña incorrecta', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'login@test.com', password: 'PasswordIncorrecta9' });

      expect(response.status).toBe(401);
    });

    test('Debe rechazar campos vacíos', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ identifier: '', password: '' });

      expect(response.status).toBe(400);
    });
  });

  describe('Control de roles y JWT', () => {
    test('El token debe contener el rol del usuario', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'rol_user',
          email: 'rol@test.com',
          password: 'Password123'
        });

      const decoded = jwt.decode(response.body.token);
      expect(decoded.role).toBe('usuario');
      expect(decoded.id).toBeDefined();
    });

    test('Rechaza peticiones sin token en rutas protegidas', async () => {
      const response = await request(app)
        .get('/api/submissions');
      expect(response.status).toBe(401);
    });

    test('Rechaza token inválido', async () => {
      const response = await request(app)
        .get('/api/submissions')
        .set('Authorization', 'Bearer token_invalido');
      expect(response.status).toBe(401);
    });

    test('Rechaza token sin prefijo Bearer', async () => {
      const response = await request(app)
        .get('/api/submissions')
        .set('Authorization', 'solo_token_sin_bearer');
      expect(response.status).toBe(401);
    });
  });

  describe('Control de roles (isAdmin)', () => {
    test('Debe permitir acceso de administrador a rutas admin', async () => {
      const user = {
        id: 5,
        username: 'super_admin',
        email: 'super@test.com',
        password_hash: await bcrypt.hash('Password123', 4),
        role: 'administrador',
        tokens: 10
      };
      dbState.users.push(user);

      const token = jwt.sign(
        { id: 5, username: 'super_admin', role: 'administrador' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeDefined();
    });

    test('Debe denegar acceso a rutas admin para usuarios normales (403)', async () => {
      const user = {
        id: 6,
        username: 'usuario_normal',
        email: 'normal@test.com',
        password_hash: await bcrypt.hash('Password123', 4),
        role: 'usuario',
        tokens: 3
      };
      dbState.users.push(user);

      const token = jwt.sign(
        { id: 6, username: 'usuario_normal', role: 'usuario' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('administrador');
    });

    test('Debe denegar acceso a rutas admin sin token (401)', async () => {
      const response = await request(app)
        .get('/api/admin/users');

      expect(response.status).toBe(401);
    });
  });
});