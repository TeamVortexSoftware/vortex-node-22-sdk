import { Vortex } from '../src/vortex';

describe('Vortex.generateJwt()', () => {
  const encodedId = 'AAAAAAAAQACAAAAAAAAAAQ'; // 00000000-0000-4000-8000-000000000001
  const rawKey = 'test-secret-key-for-signing';
  const testApiKey = `VRTX.${encodedId}.${rawKey}`;

  const vortex = new Vortex(testApiKey);

  describe('default expiration (30 days)', () => {
    it('should default to 30 day expiration', () => {
      const jwt = vortex.generateJwt({ user: { id: 'user-1', email: 'test@example.com' } });
      const [headerB64, payloadB64] = jwt.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const diff = payload.expires - header.iat;
      expect(diff).toBeGreaterThanOrEqual(30 * 24 * 60 * 60 - 1);
      expect(diff).toBeLessThanOrEqual(30 * 24 * 60 * 60 + 1);
    });
  });

  describe('custom expiration via options', () => {
    it('should accept minutes format (e.g., "10m")', () => {
      const jwt = vortex.generateJwt(
        { user: { id: 'user-1', email: 'test@example.com' } },
        { expiresIn: '10m' }
      );
      const [headerB64, payloadB64] = jwt.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const diff = payload.expires - header.iat;
      expect(diff).toBeGreaterThanOrEqual(599);
      expect(diff).toBeLessThanOrEqual(601);
    });

    it('should accept hours format (e.g., "24h")', () => {
      const jwt = vortex.generateJwt(
        { user: { id: 'user-1', email: 'test@example.com' } },
        { expiresIn: '24h' }
      );
      const [headerB64, payloadB64] = jwt.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const diff = payload.expires - header.iat;
      expect(diff).toBeGreaterThanOrEqual(86399);
      expect(diff).toBeLessThanOrEqual(86401);
    });

    it('should accept days format (e.g., "7d")', () => {
      const jwt = vortex.generateJwt(
        { user: { id: 'user-1', email: 'test@example.com' } },
        { expiresIn: '7d' }
      );
      const [headerB64, payloadB64] = jwt.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const diff = payload.expires - header.iat;
      expect(diff).toBeGreaterThanOrEqual(604799);
      expect(diff).toBeLessThanOrEqual(604801);
    });

    it('should accept numeric seconds', () => {
      const jwt = vortex.generateJwt(
        { user: { id: 'user-1', email: 'test@example.com' } },
        { expiresIn: 7200 }
      );
      const [headerB64, payloadB64] = jwt.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const diff = payload.expires - header.iat;
      expect(diff).toBeGreaterThanOrEqual(7199);
      expect(diff).toBeLessThanOrEqual(7201);
    });

    it('should reject invalid string format', () => {
      expect(() =>
        vortex.generateJwt(
          { user: { id: 'user-1', email: 'test@example.com' } },
          { expiresIn: 'invalid' }
        )
      ).toThrow(/Invalid expiresIn format/);
    });

    it('should reject negative numbers', () => {
      expect(() =>
        vortex.generateJwt(
          { user: { id: 'user-1', email: 'test@example.com' } },
          { expiresIn: -100 }
        )
      ).toThrow(/Invalid expiresIn value/);
    });

    it('should reject zero', () => {
      expect(() =>
        vortex.generateJwt({ user: { id: 'user-1', email: 'test@example.com' } }, { expiresIn: 0 })
      ).toThrow(/Invalid expiresIn value/);
    });

    it('should work without options (backward compatible)', () => {
      const jwt = vortex.generateJwt({ user: { id: 'user-1', email: 'test@example.com' } });
      expect(jwt).toBeDefined();
      expect(jwt.split('.')).toHaveLength(3);
    });
  });
});
