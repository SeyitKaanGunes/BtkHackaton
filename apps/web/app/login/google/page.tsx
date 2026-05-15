"use client";

import { useEffect, useState } from "react";
import { loginWithGoogle } from "../../../lib/web-auth";

export default function GoogleLoginCallbackPage() {
  const [message, setMessage] = useState("Google oturumu doğrulanıyor...");

  useEffect(() => {
    async function finishGoogleLogin() {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const error = params.get("error");
      if (error) {
        redirectToLogin(error);
        return;
      }

      const idToken = params.get("id_token")?.trim();
      const returnedState = params.get("state")?.trim();
      const expectedState = window.sessionStorage.getItem("fintwin_google_state");
      const nonce = window.sessionStorage.getItem("fintwin_google_nonce") ?? undefined;
      const accountType = window.sessionStorage.getItem("fintwin_account_type") === "business" ? "business" : "personal";
      window.sessionStorage.removeItem("fintwin_google_state");
      window.sessionStorage.removeItem("fintwin_google_nonce");
      window.sessionStorage.removeItem("fintwin_account_type");

      if (!idToken) {
        redirectToLogin("Google oturum token'ı alınamadı.");
        return;
      }
      if (!expectedState || !returnedState || expectedState !== returnedState) {
        redirectToLogin("Google oturum doğrulaması geçersiz.");
        return;
      }

      try {
        const result = await loginWithGoogle({ idToken, nonce, accountType });
        window.location.replace(result.user.accountType === "business" ? "/business" : "/dashboard");
      } catch (loginError) {
        redirectToLogin(loginError instanceof Error ? loginError.message : "Google ile oturum açılamadı.");
      }
    }

    void finishGoogleLogin();
  }, []);

  function redirectToLogin(error: string) {
    setMessage(error);
    const url = new URL("/login", window.location.origin);
    url.searchParams.set("error", error);
    window.location.replace(url.toString());
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel auth-callback-panel">
        <div>
          <span className="brand-mark image-brand-mark">
            <img src="/fintwin-logo.png" alt="" />
          </span>
          <p className="eyebrow">Fintwin</p>
          <h1>Google oturumu işleniyor.</h1>
          <p className="header-subtitle">{message}</p>
        </div>
      </section>
    </main>
  );
}
