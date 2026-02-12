import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Vortex } from '../src/vortex';

describe('Vortex.acceptInvitation', () => {
  let vortex: Vortex;

  beforeEach(() => {
    // Create instance with a dummy API key
    vortex = new Vortex('VRTX.dGVzdGlk.dGVzdGtleQ');
  });

  it('should delegate to acceptInvitations with a single-element array', async () => {
    const mockResult = { id: 'inv-123', status: 'accepted' };
    const acceptInvitationsSpy = jest
      .spyOn(vortex, 'acceptInvitations')
      .mockResolvedValue(mockResult as any);

    const user = { email: 'user@example.com', name: 'John' };
    const result = await vortex.acceptInvitation('inv-123', user);

    expect(acceptInvitationsSpy).toHaveBeenCalledTimes(1);
    expect(acceptInvitationsSpy).toHaveBeenCalledWith(['inv-123'], user);
    expect(result).toBe(mockResult);
  });

  it('should pass through the user object unchanged', async () => {
    const mockResult = { id: 'inv-456', status: 'accepted' };
    const acceptInvitationsSpy = jest
      .spyOn(vortex, 'acceptInvitations')
      .mockResolvedValue(mockResult as any);

    const user = { phone: '+18005551234' };
    await vortex.acceptInvitation('inv-456', user);

    expect(acceptInvitationsSpy).toHaveBeenCalledWith(['inv-456'], user);
  });
});
