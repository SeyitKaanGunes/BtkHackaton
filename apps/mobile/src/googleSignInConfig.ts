type RuntimeEnv = Record<string, string | undefined>;

const googleClientIdPlaceholderValues = new Set([
  "optional-google-oauth-client-id",
  "your-google-oauth-client-id",
  "your-google-oauth-web-client-id",
  "replace-with-google-oauth-client-id"
]);

export function pickGoogleWebClientId(input: { env?: RuntimeEnv; nativeGoogleWebClientId?: string | null }) {
  const candidates = [
    input.nativeGoogleWebClientId,
    input.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    input.env?.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    input.env?.GOOGLE_OAUTH_CLIENT_ID
  ];

  return candidates.map((value) => value?.trim()).find((value): value is string => Boolean(value && !googleClientIdPlaceholderValues.has(value)));
}

export function googleWebClientIdMissingMessage() {
  return "Google girişi için EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID veya Android FINTWIN_GOOGLE_WEB_CLIENT_ID tanımlı olmalı.";
}
