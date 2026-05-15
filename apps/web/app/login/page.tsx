import { AuthForm } from "../../components/auth-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <span className="brand-mark image-brand-mark">
            <img src="/fintwin-logo.png" alt="" />
          </span>
          <p className="eyebrow">Fintwin</p>
          <h1>Hesap türünü seç, finansal ikizine giriş yap.</h1>
          <p className="header-subtitle">Kişisel ve KOBİ hesapları ayrı arayüzlere yönlenir; her dashboard yalnızca kendi oturum verilerini okur.</p>
        </div>
        <AuthForm />
      </section>
    </main>
  );
}
