"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { login, register } from "../lib/api";

type AuthMode = "login" | "register";

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result =
        mode === "register"
          ? await register({ name: name.trim(), email: email.trim(), password })
          : await login({ email: email.trim(), password });
      persistSession(result.token);
      window.location.href = "/";
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Oturum açılamadı.");
    } finally {
      setPending(false);
    }
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

      <label className="field">
        <span>E-posta</span>
        <div className="auth-input">
          <Mail size={18} />
          <input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" autoComplete="email" />
        </div>
      </label>

      <label className="field">
        <span>Şifre</span>
        <div className="auth-input">
          <LockKeyhole size={18} />
          <input value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
      </label>

      {error ? <p className="form-message danger">{error}</p> : null}

      <button className="secondary-button auth-submit" disabled={pending} type="submit">
        {pending ? "Bekle..." : mode === "login" ? "Giriş yap" : "Hesap oluştur"}
      </button>
    </form>
  );
}

function persistSession(token: string) {
  window.localStorage.setItem("fintwin_token", token);
  document.cookie = `fintwin_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
}
