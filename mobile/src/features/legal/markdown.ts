import type { LegalDocument } from './content';

/** The hosted (Markdown) version of a legal document, so the public page always matches the app. */
export function toMarkdown(doc: LegalDocument): string {
  const sections = doc.sections.map((s) => `## ${s.heading}\n\n${s.body.join('\n\n')}`).join('\n\n');
  return `<!-- Generated from mobile/src/features/legal/content.ts. Edit that file, then run: UPDATE_LEGAL=1 npx jest legal -->\n\n# Progression ${doc.title}\n\n_Last updated ${doc.updated}_\n\n${doc.intro}\n\n${sections}\n`;
}
