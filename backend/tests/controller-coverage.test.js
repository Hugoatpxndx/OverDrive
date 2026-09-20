/**
 * Pruebas de cobertura: validaciones defensivas y caminos de error 500.
 *
 * Muchas validaciones se despachan ANTES en express-validator (en las rutas),
 * por lo que las comprobaciones defensivas dentro de los controladores quedan
 * en ramas poco ejercitadas. Aquí se invocan los controladores DIRECTAMENTE
 * (sin pasar por las rutas ni por express-validator) para cubrir esas ramas
 * y los caminos de error de base de datos (500).
 */
jest.mock('../config/db', () => ({
  executeQuery: jest.fn(async () => [])
}));

const { executeQuery } = require('../config/db');
const { register, login } = require('../controllers/authController');
const { listUsers } = require('../controllers/adminController');
const { createPlaylist } = require('../controllers/playlistController');

process.env.JWT_SECRET = 'test_secret_secure';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const URL_PLAYLIST_VALIDA = 'https://open.spotify.com/playlist/AbCdEfGhIjKlMnOpQr123';

describe('Cobertura: validaciones defensivas y errores 500', () => {
  beforeEach(() => {
    executeQuery.mockReset();
    executeQuery.mockResolvedValue([]);
  });

  describe('authController.register', () => {
    test('rechaza cuerpo vacío (400)', async () => {
      const res = mockRes();
      await register({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rechaza username con caracteres no permitidos (400)', async () => {
      const res = mockRes();
      await register({ body: { username: 'ab@c', email: 'a@b.co', password: '12345678' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rechaza email inválido (400)', async () => {
      const res = mockRes();
      await register({ body: { username: 'bien', email: 'no-es-email', password: '12345678' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rechaza contraseña corta (400)', async () => {
      const res = mockRes();
      await register({ body: { username: 'bien', email: 'a@b.co', password: 'corta' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('responde 500 si la BD falla al registrar', async () => {
      executeQuery.mockRejectedValueOnce(new Error('db down'));
      const res = mockRes();
      await register({ body: { username: 'bien', email: 'a@b.co', password: '12345678' } }, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('authController.login', () => {
    test('rechaza credenciales vacías (400)', async () => {
      const res = mockRes();
      await login({ body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('responde 500 si la BD falla al hacer login', async () => {
      executeQuery.mockRejectedValueOnce(new Error('db down'));
      const res = mockRes();
      await login({ body: { identifier: 'x', password: 'y' } }, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('adminController.listUsers', () => {
    test('responde 500 si la BD falla al listar usuarios', async () => {
      executeQuery.mockRejectedValueOnce(new Error('db down'));
      const res = mockRes();
      await listUsers({}, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('playlistController.createPlaylist', () => {
    test('responde 500 si la BD falla al crear playlist', async () => {
      executeQuery.mockRejectedValueOnce(new Error('db down'));
      const res = mockRes();
      await createPlaylist(
        {
          user: { id: 1 },
          body: { name: 'Mi lista', spotifyUrl: URL_PLAYLIST_VALIDA, followers: '10' }
        },
        res
      );
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});