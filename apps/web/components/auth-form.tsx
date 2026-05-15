"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { login, register } from "../lib/web-auth";

type AuthMode = "login" | "register";
type AccountType = "personal" | "business";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const googleError = new URLSearchParams(window.location.search).get("error");
    if (googleError) setError(googleError);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result =
        mode === "register"
          ? await register({ name: name.trim(), email: email.trim(), password, accountType })
          : await login({ email: email.trim(), password, accountType });
      window.location.href = result.user.accountType === "business" ? "/business" : "/dashboard";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Oturum açılamadı.");
    } finally {
      setPending(false);
    }
  }

  function startGoogleRedirect() {
    if (!googleClientId) return;
    const state = randomToken();
    const nonce = randomToken();
    window.sessionStorage.setItem("fintwin_google_state", state);
    window.sessionStorage.setItem("fintwin_google_nonce", nonce);
    window.sessionStorage.setItem("fintwin_account_type", accountType);

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: `${window.location.origin}/login/google`,
      response_type: "id_token",
      response_mode: "fragment",
      scope: "openid email profile",
      prompt: "select_account",
      state,
      nonce
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div className="segmented-tabs auth-tabs">
        <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
          Giriş
        </button>
        <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>
          Kayıt
        </button>
      </div>

      {mode === "register" ? (
        <label className="field">
          <span>Ad Soyad</span>
          <div className="auth-input">
            <UserRound size={18} />
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} autoComplete="name" />
          </div>
        </label>
      ) : null}

      <div className="field">
        <span>Hesap türü</span>
        <div className="account-type-grid" role="radiogroup" aria-label="Hesap türü">
          <button className={accountType === "personal" ? "active" : ""} type="button" role="radio" aria-checked={accountType === "personal"} onClick={() => setAccountType("personal")}>
            <strong>Kişisel</strong>
            <small>Bütçe, portföy ve harcama içgörüleri</small>
          </button>
          <button className={accountType === "business" ? "active" : ""} type="button" role="radio" aria-checked={accountType === "business"} onClick={() => setAccountType("business")}>
            <strong>KOBİ</strong>
            <small>Nakit akışı, tahsilat ve işletme ekranı</small>
          </button>
        </div>
      </div>

      <label className="field">
        <span>E-posta</span>
        <div className="auth-input">
          <Mail size={18} />
          <input value={email} onChange={(event) => setEmail(event.target.value)} required type={mode === "login" ? "text" : "email"} autoComplete="email" />
        </div>
      </label>

      <label className="field">
        <span>Şifre</span>
        <div className="auth-input">
          <LockKeyhole size={18} />
          <input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "login" ? 1 : 6} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
      </label>

      {error ? <p className="form-message danger">{error}</p> : null}

      {googleClientId ? (
        <>
          <div className="auth-separator">
            <span />
            <small>veya</small>
            <span />
          </div>
          <button className="google-auth-button" disabled={pending} type="button" onClick={startGoogleRedirect}>
            <GoogleLogo />
            <span>Google ile oturum aç</span>
          </button>
        </>
      ) : null}

      <button className="secondary-button auth-submit" disabled={pending} type="submit">
        {pending ? "Bekle..." : mode === "login" ? "Giriş yap" : "Hesap oluştur"}
      </button>
    </form>
  );
}

function randomToken() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="google-auth-logo" viewBox="0 0 18 18">
      <path
        fill="#4285f4"
        d="M17.64 9.2c0-.63-.06-1.24-.16-1.82H9v3.44h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.6Z"
      />
      <path
        fill="#34a853"
        d="M9 18c2.43 0 4.47-.81 5.96-2.2l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.94v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#fbbc05"
        d="M3.96 10.69A5.41 5.41 0 0 1 3.68 9c0-.58.1-1.15.28-1.69V4.98H.94A9 9 0 0 0 0 9c0 1.45.34 2.82.94 4.02l3.02-2.33Z"
      />
      <path
        fill="#ea4335"
        d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .94 4.98l3.02 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
