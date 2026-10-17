import { formatRest, remainingSeconds, useRestTimer } from '@/features/workout/restTimer';

const timer = () => useRestTimer.getState();
const T0 = 1_000_000;

beforeEach(() => {
  timer().stop();
  timer().setDefault(120);
});

describe('rest timer', () => {
  it('starts with the default length', () => {
    timer().startDefault(T0);
    expect(remainingSeconds(timer().endsAt, T0)).toBe(120);
    expect(remainingSeconds(timer().endsAt, T0 + 45_000)).toBe(75);
    expect(remainingSeconds(timer().endsAt, T0 + 200_000)).toBe(0);
  });

  it('does nothing when turned off', () => {
    timer().setDefault(0);
    timer().startDefault(T0);
    expect(timer().endsAt).toBeNull();
  });

  it('adds and removes time, never below 5 seconds', () => {
    timer().startDefault(T0);
    timer().adjust(15, T0);
    expect(remainingSeconds(timer().endsAt, T0)).toBe(135);
    timer().adjust(-500, T0);
    expect(remainingSeconds(timer().endsAt, T0)).toBe(5);
  });

  it('turning the timer off cancels a running rest', () => {
    timer().startDefault(T0);
    timer().setDefault(0);
    expect(timer().endsAt).toBeNull();
  });

  it('formats rest lengths', () => {
    expect(formatRest(0)).toBe('Off');
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(45)).toBe('0:45');
  });
});
