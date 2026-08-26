/**
 * The collector's route to a human when the app cannot help — today, a
 * locked ZaloPay wallet, which only ZaloPay can unlock and only VNG can
 * reassure about.
 *
 * ponytail: no support channel exists yet in either repository — no hotline,
 * no Zalo OA, no support mailbox for the pilot. Until ops names one, this is
 * `null` and the result screen renders the plain-language explanation with
 * no "contact" button, rather than a button that dials a placeholder. Set it
 * to a `tel:`, `mailto:` or `https:` URL and the button appears.
 */
export const SUPPORT_URL: string | null = null;
