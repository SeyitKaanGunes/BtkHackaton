import { AuthForm } from "../../components/auth-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div>
          <span className="brand-mark">FS</span>
          <p className="eyebrow">Fintwin</p>
          <h1>Finansal ikizine giriş yap.</h1>
          <p className="header-subtitle">Kişisel veriler token ile ayrılır; her dashboard yalnızca oturum kullanıcısının kayıtlarını okur.</p>
        </div>
        <AuthForm />
      </section>
    </main>
  );
}
