/**
 * Invented API keys for tests, assembled from parts instead of written whole.
 *
 * These were spelled out as plain literals, and GitHub's secret scanning
 * mailed a "secrets detected" alert about two of them. It was not wrong to:
 * it matches Google's key *shape*, and a scanner cannot tell a fixture named
 * TESTKEYNOTREAL from a live credential — only a human reading the line can.
 *
 * Nothing real was ever exposed. But a repository that trips its own scanner
 * teaches everyone to wave the alerts away, and the next one might be real. So
 * the keys are built at run time: the tests still see the exact shape they
 * need to exercise, while no key-shaped literal sits in the source for a
 * scanner — or a person skimming a diff — to mistake for the genuine article.
 *
 * Keeping them in one place also means the app's accepted formats and the
 * fixtures proving them can no longer drift apart.
 */

/** Joins the parts, so the finished shape never appears contiguously above. */
const assemble = (...parts) => parts.join('')

/** Google's long-standing API key: `AIza` and 35 more characters. */
export const FAKE_GEMINI_KEY = assemble('AIza', 'SyFLUENTIAFIXTURE', 'NOTAREALKEY0000000')

/** A second one, for tests that need two distinct Gemini keys. */
export const FAKE_GEMINI_KEY_ALT = assemble('AIza', 'SyFLUENTIAFIXTURE', 'NOTAREALKEY1111111')

/** Google AI Studio's newer auth key, whose prefix carries a dot. */
export const FAKE_GEMINI_AUTH_KEY = assemble('AQ.', 'Ab8RN6FLUENTIAFIXTURE', 'NOTAREALKEY000000')

/** The same, using every character class a real auth key may contain. */
export const FAKE_GEMINI_AUTH_KEY_PUNCTUATED = assemble(
  'AQ.',
  'Ab8RN6_FLUENTIA-FIXTURE.',
  'NOTAREALKEY000000',
)

/** An OpenAI project key, for proving the wrong provider's key is refused. */
export const FAKE_OPENAI_KEY = assemble('sk-', 'proj-FLUENTIAFIXTURE', 'notarealkey0000000')

/** A second one, for tests that need two distinct OpenAI keys. */
export const FAKE_OPENAI_KEY_ALT = assemble('sk-', 'proj-FLUENTIAFIXTURE', 'notarealkey1111111')
