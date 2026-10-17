import { isValidEmail, isValidPassword, normalizeEmail, toE164 } from '@/features/auth/validation';

describe('toE164', () => {
  it('combines country code and a formatted local number', () => {
    expect(toE164('1', '(555) 123-4567')).toBe('+15551234567');
    expect(toE164('+44', '7911 123456')).toBe('+447911123456');
  });

  it('rejects numbers that are too short or too long', () => {
    expect(toE164('1', '555')).toBeNull();
    expect(toE164('1', '1234567890123456')).toBeNull();
  });

  it('rejects a country code starting with 0', () => {
    expect(toE164('0', '5551234567')).toBeNull();
  });
});

describe('password rules', () => {
  it.each([
    ['Password1', true],
    ['password1', false], // no uppercase
    ['PASSWORD1', false], // no lowercase
    ['Password', false], // no digit
    ['Pass1', false], // too short
  ])('%s → %s', (password, valid) => {
    expect(isValidPassword(password)).toBe(valid);
  });
});

describe('email', () => {
  it('validates and normalizes', () => {
    expect(isValidEmail(' Lifter@Example.com ')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(normalizeEmail(' Lifter@Example.COM ')).toBe('lifter@example.com');
  });
});
