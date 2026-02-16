import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Must set __SDK_VERSION__ before importing Vortex since it's evaluated at module load
(globalThis as Record<string, unknown>).__SDK_VERSION__ = '0.8.1';

import { Vortex } from '../src/vortex';

describe('Vortex SDK headers', () => {
  let vortex: Vortex;
  let fetchSpy: jest.SpiedFunction<typeof global.fetch>;

  beforeEach(() => {
    vortex = new Vortex('VRTX.dGVzdGlk.dGVzdGtleQ');
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('should send x-vortex-sdk-name and x-vortex-sdk-version headers on API requests', async () => {
    try {
      await vortex.getInvitation('inv-123');
    } catch {
      // may fail due to dummy key, that's fine
    }

    expect(fetchSpy).toHaveBeenCalled();
    const callArgs = fetchSpy.mock.calls[0];
    const requestInit = callArgs[1] as RequestInit;
    const headers = requestInit.headers as Record<string, string>;

    expect(headers['x-vortex-sdk-name']).toBe('vortex-node-sdk');
    expect(headers['x-vortex-sdk-version']).toBe('0.8.1');
  });
});
