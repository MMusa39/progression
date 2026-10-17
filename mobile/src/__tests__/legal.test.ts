/**
 * The privacy policy and terms exist twice: in the app, and as Markdown in
 * docs/legal/ for the public URL the App Store requires. This keeps them identical.
 * After editing content.ts, regenerate with: UPDATE_LEGAL=1 npx jest legal
 */
import fs from 'node:fs';
import path from 'node:path';

import { PRIVACY_POLICY, TERMS } from '@/features/legal/content';
import { toMarkdown } from '@/features/legal/markdown';

const docs = path.resolve(__dirname, '../../../docs/legal');

describe.each([
  ['privacy-policy.md', PRIVACY_POLICY],
  ['terms.md', TERMS],
])('%s', (file, content) => {
  it('matches the in-app text', () => {
    const target = path.join(docs, file);
    const expected = toMarkdown(content);
    if (process.env.UPDATE_LEGAL) fs.writeFileSync(target, expected);
    expect(fs.readFileSync(target, 'utf8')).toBe(expected);
  });
});
