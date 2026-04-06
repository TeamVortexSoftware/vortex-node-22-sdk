import { Vortex } from '../src/vortex';
import crypto from 'node:crypto';
import { stringify as uuidStringify } from 'uuid';

describe('Vortex.sign()', () => {
  // Test API key: VRTX.<base64url UUID>.<key>
  // Use a valid v4 UUID for testing
  const encodedId = 'AAAAAAAAQACAAAAAAAAAAQ'; // 00000000-0000-4000-8000-000000000001
  const uuidBytes = Buffer.from(encodedId, 'base64url');
  const rawKey = 'test-secret-key-for-signing';
  const testApiKey = `VRTX.${encodedId}.${rawKey}`;

  const vortex = new Vortex(testApiKey);

  // Derive expected kid and signing key
  const expectedKid = uuidStringify(uuidBytes);
  const expectedSigningKey = crypto.createHmac('sha256', rawKey).update(expectedKid).digest();

  it('should return kid:hexDigest format', () => {
    const sig = vortex.sign({ id: 'user-1', email: 'test@example.com' });
    expect(sig).toMatch(/^[0-9a-f-]+:[0-9a-f]{64}$/);
    expect(sig.startsWith(expectedKid + ':')).toBe(true);
  });

  it('should produce deterministic output for same input', () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    const sig1 = vortex.sign(user);
    const sig2 = vortex.sign(user);
    expect(sig1).toBe(sig2);
  });

  it('should produce different output for different users', () => {
    const sig1 = vortex.sign({ id: 'user-1', email: 'a@example.com' });
    const sig2 = vortex.sign({ id: 'user-2', email: 'b@example.com' });
    expect(sig1).not.toBe(sig2);
  });

  it('should transform User shape to UnsignedData shape (id→userId, email→userEmail)', () => {
    const user = { id: 'user-1', email: 'test@example.com' };
    const sig = vortex.sign(user);
    const digest = sig.split(':')[1];

    // Manually compute what the signature should be
    const canonical = { userId: 'user-1', userEmail: 'test@example.com' };
    const expectedCanonical = JSON.stringify(canonical, Object.keys(canonical).sort());
    const expectedDigest = crypto
      .createHmac('sha256', expectedSigningKey)
      .update(expectedCanonical)
      .digest('hex');

    expect(digest).toBe(expectedDigest);
  });

  it('should sort keys alphabetically for canonical JSON', () => {
    // With new property names: name comes after email but before userId alphabetically
    // The sorted order should be: name, userEmail, userId
    const user = { id: 'u1', email: 'e@x.com', name: 'Test' };
    const sig = vortex.sign(user);
    const digest = sig.split(':')[1];

    const canonical = { name: 'Test', userEmail: 'e@x.com', userId: 'u1' };
    const expectedCanonical = JSON.stringify(canonical, Object.keys(canonical).sort());
    const expectedDigest = crypto
      .createHmac('sha256', expectedSigningKey)
      .update(expectedCanonical)
      .digest('hex');

    expect(digest).toBe(expectedDigest);
  });

  it('should include optional fields when present', () => {
    const user = {
      id: 'u1',
      email: 'e@x.com',
      name: 'Test',
      avatarUrl: 'https://example.com/avatar.png',
      adminScopes: ['autojoin'],
      allowedEmailDomains: ['example.com'],
    };
    const sig = vortex.sign(user);
    expect(sig).toMatch(/^[0-9a-f-]+:[0-9a-f]{64}$/);
  });

  it('should accept deprecated userName/userAvatarUrl for backwards compatibility', () => {
    const user = {
      id: 'u1',
      email: 'e@x.com',
      userName: 'Test', // deprecated
      userAvatarUrl: 'https://example.com/avatar.png', // deprecated
    };
    const sig = vortex.sign(user);
    expect(sig).toMatch(/^[0-9a-f-]+:[0-9a-f]{64}$/);
  });

  it('should throw on invalid API key', () => {
    const bad = new Vortex('invalid-key');
    expect(() => bad.sign({ id: 'u1', email: 'e@x.com' })).toThrow('Invalid API key');
  });
});
