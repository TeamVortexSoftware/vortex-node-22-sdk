import { Vortex } from '../src/vortex';

describe('Vortex.generateToken()', () => {
  // Test API key: VRTX.<base64url UUID>.<key>
  const encodedId = 'AAAAAAAAQACAAAAAAAAAAQ'; // 00000000-0000-4000-8000-000000000001
  const rawKey = 'test-secret-key-for-signing';
  const testApiKey = `VRTX.${encodedId}.${rawKey}`;

  const vortex = new Vortex(testApiKey);

  describe('JWT structure', () => {
    it('should return a valid JWT format (header.payload.signature)', () => {
      const token = vortex.generateToken({ user: { id: 'user-1' } });
      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      // Each part should be base64url encoded
      expect(() => Buffer.from(parts[0], 'base64url')).not.toThrow();
      expect(() => Buffer.from(parts[1], 'base64url')).not.toThrow();
    });

    it('should include correct header with alg, typ, and kid', () => {
      const token = vortex.generateToken({ user: { id: 'user-1' } });
      const [headerB64] = token.split('.');
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

      expect(header.alg).toBe('HS256');
      expect(header.typ).toBe('JWT');
      expect(header.kid).toBeDefined();
      expect(typeof header.kid).toBe('string');
    });

    it('should include payload data in JWT payload', () => {
      const token = vortex.generateToken({
        component: 'widget-123',
        user: { id: 'user-1', name: 'Peter', email: 'peter@example.com' },
        scope: 'workspace_456',
        vars: { company_name: 'Acme' },
      });

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      expect(payload.component).toBe('widget-123');
      expect(payload.user).toEqual({ id: 'user-1', name: 'Peter', email: 'peter@example.com' });
      expect(payload.scope).toBe('workspace_456');
      expect(payload.vars).toEqual({ company_name: 'Acme' });
    });

    it('should include iat and exp claims', () => {
      const before = Math.floor(Date.now() / 1000);
      const token = vortex.generateToken({ user: { id: 'user-1' } });
      const after = Math.floor(Date.now() / 1000);

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      expect(payload.iat).toBeGreaterThanOrEqual(before);
      expect(payload.iat).toBeLessThanOrEqual(after);
      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });
  });

  describe('default expiration (5 minutes)', () => {
    it('should default to 5 minute expiration', () => {
      const token = vortex.generateToken({ user: { id: 'user-1' } });

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const expectedExp = payload.iat + 5 * 60; // 5 minutes
      expect(payload.exp).toBe(expectedExp);
    });
  });

  describe('custom expiration', () => {
    it('should accept minutes format (e.g., "10m")', () => {
      const token = vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: '10m' });

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const expectedExp = payload.iat + 10 * 60;
      expect(payload.exp).toBe(expectedExp);
    });

    it('should accept hours format (e.g., "1h")', () => {
      const token = vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: '1h' });

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const expectedExp = payload.iat + 60 * 60;
      expect(payload.exp).toBe(expectedExp);
    });

    it('should accept days format (e.g., "7d")', () => {
      const token = vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: '7d' });

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const expectedExp = payload.iat + 7 * 24 * 60 * 60;
      expect(payload.exp).toBe(expectedExp);
    });

    it('should accept raw seconds as number', () => {
      const token = vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: 3600 });

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      const expectedExp = payload.iat + 3600;
      expect(payload.exp).toBe(expectedExp);
    });

    it('should throw on invalid format', () => {
      expect(() => {
        vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: 'invalid' });
      }).toThrow('Invalid expiresIn format');

      expect(() => {
        vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: '10x' });
      }).toThrow('Invalid expiresIn format');
    });

    it('should throw on zero duration', () => {
      expect(() => {
        vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: '0m' });
      }).toThrow('Duration must be positive');

      expect(() => {
        vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: '0h' });
      }).toThrow('Duration must be positive');

      expect(() => {
        vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: '0d' });
      }).toThrow('Duration must be positive');

      expect(() => {
        vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: 0 });
      }).toThrow('Numeric expiresIn must be a positive integer');
    });

    it('should throw on negative numeric expiresIn', () => {
      expect(() => {
        vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: -60 });
      }).toThrow('Numeric expiresIn must be a positive integer');
    });
  });

  describe('user.id warning', () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should warn when user.id is missing', () => {
      vortex.generateToken({ component: 'widget-123' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('signing payload without user.id')
      );
    });

    it('should warn when user exists but id is missing', () => {
      vortex.generateToken({ user: { name: 'Peter' } as any });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('signing payload without user.id')
      );
    });

    it('should not warn when user.id is present', () => {
      vortex.generateToken({ user: { id: 'user-1' } });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should not warn when user.id is numeric', () => {
      vortex.generateToken({ user: { id: 12345 } });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('payload variations', () => {
    it('should handle minimal payload (just user.id)', () => {
      const token = vortex.generateToken({ user: { id: 'user-1' } });

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      expect(payload.user).toEqual({ id: 'user-1' });
    });

    it('should handle payload with custom properties', () => {
      const token = vortex.generateToken({
        user: { id: 'user-1' },
        customField: 'custom-value',
        nested: { deep: { value: true } },
      });

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      expect(payload.customField).toBe('custom-value');
      expect(payload.nested).toEqual({ deep: { value: true } });
    });

    it('should handle user with custom properties', () => {
      const token = vortex.generateToken({
        user: {
          id: 'user-1',
          customUserProp: 'value',
          metadata: { role: 'admin' },
        },
      });

      const [, payloadB64] = token.split('.');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      expect(payload.user.customUserProp).toBe('value');
      expect(payload.user.metadata).toEqual({ role: 'admin' });
    });
  });

  describe('signature verification', () => {
    it('should produce identical tokens for same payload when timestamp is fixed', () => {
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);

      try {
        const token1 = vortex.generateToken({ user: { id: 'user-1' } });
        const token2 = vortex.generateToken({ user: { id: 'user-1' } });

        // Entire tokens should be identical (same payload, same iat/exp, same signature)
        expect(token1).toBe(token2);
      } finally {
        nowSpy.mockRestore();
      }
    });

    it('should produce different signatures for different payloads', () => {
      const token1 = vortex.generateToken({ user: { id: 'user-1' } });
      const token2 = vortex.generateToken({ user: { id: 'user-2' } });

      const sig1 = token1.split('.')[2];
      const sig2 = token2.split('.')[2];
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('error handling', () => {
    it('should throw on invalid API key', () => {
      const badVortex = new Vortex('invalid-key');
      expect(() => badVortex.generateToken({ user: { id: 'user-1' } })).toThrow('Invalid API key');
    });

    it('should throw on invalid numeric expiresIn (zero)', () => {
      expect(() => vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: 0 })).toThrow(
        'positive integer'
      );
    });

    it('should throw on invalid numeric expiresIn (negative)', () => {
      expect(() => vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: -300 })).toThrow(
        'positive integer'
      );
    });

    it('should throw on invalid numeric expiresIn (NaN)', () => {
      expect(() => vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: NaN })).toThrow(
        'positive integer'
      );
    });

    it('should throw on invalid numeric expiresIn (Infinity)', () => {
      expect(() =>
        vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: Infinity })
      ).toThrow('positive integer');
    });

    it('should throw on invalid numeric expiresIn (float)', () => {
      expect(() => vortex.generateToken({ user: { id: 'user-1' } }, { expiresIn: 300.5 })).toThrow(
        'positive integer'
      );
    });
  });
});
