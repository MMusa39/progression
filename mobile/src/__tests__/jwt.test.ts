import { decodeJwt } from '@/lib/jwt';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('decodeJwt', () => {
  it('reads claims from the payload, including non-ASCII text', () => {
    const token = `${encode({ alg: 'none' })}.${encode({ sub: 'user-1', name: 'José Müller', exp: 123 })}.sig`;
    expect(decodeJwt(token)).toEqual({ sub: 'user-1', name: 'José Müller', exp: 123 });
  });

  it('rejects malformed tokens', () => {
    expect(() => decodeJwt('not-a-jwt')).toThrow('Malformed JWT');
  });
});
