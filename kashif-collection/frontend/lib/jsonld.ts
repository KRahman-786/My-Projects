/** Serialises structured data for a <script type="application/ld+json"> tag, escaping "<" so content can never close the tag. */
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
