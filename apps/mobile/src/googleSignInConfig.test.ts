import { describe, expect, it } from "vitest";
import { pickGoogleWebClientId } from "./googleSignInConfig";

describe("mobile Google sign-in config", () => {
  it("uses the Android native web client id before environment fallbacks", () => {
    expect(
      pickGoogleWebClientId({
        nativeGoogleWebClientId: " android-web-client.apps.googleusercontent.com ",
        env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "env-web-client.apps.googleusercontent.com" }
      })
    ).toBe("android-web-client.apps.googleusercontent.com");
  });

  it("falls back to supported public environment names", () => {
    expect(
      pickGoogleWebClientId({
        env: { NEXT_PUBLIC_GOOGLE_CLIENT_ID: " web-client.apps.googleusercontent.com " }
      })
    ).toBe("web-client.apps.googleusercontent.com");
  });

  it("ignores empty and placeholder client ids", () => {
    expect(
      pickGoogleWebClientId({
        nativeGoogleWebClientId: "",
        env: { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "your-google-oauth-web-client-id" }
      })
    ).toBeUndefined();
  });
});
