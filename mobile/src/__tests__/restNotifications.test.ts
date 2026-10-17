import * as Notifications from 'expo-notifications';

import { syncRestNotification } from '@/features/workout/restNotifications';

const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const permissions = Notifications.getPermissionsAsync as jest.Mock;
const NOW = 1_000_000;

beforeEach(async () => {
  await syncRestNotification(null, true, NOW); // clear anything a previous test scheduled
  schedule.mockClear();
  cancel.mockClear();
});

describe('rest-over notification', () => {
  it('schedules for the time remaining', async () => {
    await syncRestNotification(NOW + 90_000, true, NOW);
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({ title: 'Rest over', data: { type: 'rest', path: '/workout' } }),
        trigger: { type: 'timeInterval', seconds: 90 },
      }),
    );
  });

  it('replaces the previous notification when the rest changes', async () => {
    await syncRestNotification(NOW + 90_000, true, NOW);
    await syncRestNotification(NOW + 105_000, true, NOW); // +15s
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenLastCalledWith(expect.objectContaining({ trigger: { type: 'timeInterval', seconds: 105 } }));
  });

  it('cancels when the rest is skipped or alerts are off', async () => {
    await syncRestNotification(NOW + 90_000, true, NOW);
    await syncRestNotification(null, true, NOW);
    expect(cancel).toHaveBeenCalled();
    schedule.mockClear();
    await syncRestNotification(NOW + 90_000, false, NOW);
    expect(schedule).not.toHaveBeenCalled();
  });

  it("doesn't schedule without permission", async () => {
    permissions.mockResolvedValueOnce({ granted: false, canAskAgain: true, ios: { status: 0 } });
    await syncRestNotification(NOW + 90_000, true, NOW);
    expect(schedule).not.toHaveBeenCalled();
  });
});
