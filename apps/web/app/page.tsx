import Link from "next/link";
import { ArrowRight, Bot, Building2, CheckCircle2, FileText, LockKeyhole, Sparkles } from "lucide-react";
import { LandingMotion } from "../components/landing-motion";

const featureCards = [
  {
    title: "Kişisel finansal ikiz",
    copy: "Gelir, gider, hedef, portföy ve abonelik sinyallerini tek bağlamda toplar.",
    icon: Sparkles
  },
  {
    title: "Belge zekası",
    copy: "Fiş ve ekstreleri doğrulama adımlarıyla gerçek işlem geçmişine çevirir.",
    icon: FileText
  },
  {
    title: "KOBİ nakit akışı",
    copy: "Tahsilat, ödeme, kasa ve senaryo etkisini ayrı işletme bağlamında izler.",
    icon: Building2
  }
];

const productFlow = ["Profilini kur", "Fiş veya ekstre ekle", "Senaryo sor", "Aksiyonu onayla"];

export default function LandingPage() {
  return (
    <LandingMotion>
      <main className="landing-page">
        <nav className="landing-nav" aria-label="Fintwin">
          <Link className="brand landing-brand" href="/">
            <span className="brand-mark image-brand-mark">
              <img src="/fintwin-logo.png" alt="" />
            </span>
            <span>
              <strong>Fintwin</strong>
              <small>Finansal ikiziniz</small>
            </span>
          </Link>
          <div className="landing-nav-links">
            <a href="#features">Modüller</a>
            <a href="#workflow">Akış</a>
            <a href="#security">Güvenlik</a>
          </div>
          <Link className="landing-nav-cta" href="/login">
            Giriş yap
            <ArrowRight size={16} />
          </Link>
        </nav>

        <section className="landing-hero">
          <div className="landing-hero-copy" data-motion="fade-up">
            <p className="eyebrow">Kişisel ve KOBİ finansal ikiz</p>
            <h1>Finansal ikizin cebinde.</h1>
            <p>
              Fintwin; harcamalarını, belgelerini, portföyünü, karar senaryolarını ve KOBİ nakit akışını tek bir sade çalışma alanında birleştirir.
            </p>
            <div className="landing-cta-row">
              <Link className="primary-landing-button" href="/login">
                Uygulamaya gir
                <ArrowRight size={17} />
              </Link>
              <a className="secondary-landing-button" href="#workflow">
                Akışı gör
              </a>
            </div>
          </div>
          <div className="landing-product-preview" data-motion="float-up" aria-label="Fintwin ürün önizlemesi">
            <div className="preview-toolbar">
              <span />
              <span />
              <span />
            </div>
            <div className="preview-score">
              <span>Finansal sağlık</span>
              <strong>78</strong>
              <small>/100</small>
            </div>
            <div className="preview-metrics">
              <PreviewMetric label="Net bakiye" value="₺42.800" />
              <PreviewMetric label="Güvenli limit" value="₺8.450" />
              <PreviewMetric label="Bekleyen aksiyon" value="3" />
            </div>
            <div className="preview-agent">
              <Bot size={18} />
              <span>₺10.000 harcama için 20 dk bekleme önerisi hazır.</span>
            </div>
          </div>
        </section>

        <section className="landing-feature-grid" id="features">
          <div className="landing-feature-large" data-motion="fade-up">
            <p className="eyebrow">Ürün omurgası</p>
            <h2>Ekranlar değil, bağlamlı finans akışı.</h2>
            <p>
              Dashboard sade kalır; derin analizler kategori, Spending DNA, what-if, belge, abonelik, agent, portföy ve KOBİ modüllerine ayrılır.
            </p>
          </div>
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <article className="landing-feature-card" data-motion="fade-up" key={card.title}>
                <Icon size={20} />
                <strong>{card.title}</strong>
                <p>{card.copy}</p>
              </article>
            );
          })}
        </section>

        <section className="landing-workflow" id="workflow">
          <div data-motion="fade-up">
            <p className="eyebrow">Canonical akış</p>
            <h2>Veri gir, simüle et, onayla.</h2>
          </div>
          <div className="workflow-rail">
            {productFlow.map((step, index) => (
              <div className="workflow-step" data-motion="float-up" key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-security" id="security">
          <div>
            <LockKeyhole size={22} />
            <h2>AI açıklama üretir; finansal kayıtlar onaysız değişmez.</h2>
          </div>
          <ul>
            <li>
              <CheckCircle2 size={17} />
              Hassas bilgiler kullanıcı onayı olmadan finansal kayda dönüştürülmez.
            </li>
            <li>
              <CheckCircle2 size={17} />
              Agent aksiyonları kullanıcı onayı olmadan bütçe, işlem veya abonelik yazmaz.
            </li>
            <li>
              <CheckCircle2 size={17} />
              Eksik veri varsa sonuçlar açık uyarıyla gösterilir.
            </li>
          </ul>
        </section>

        <footer className="landing-footer">
          <div>
            <strong>Fintwin</strong>
            <span>Kişisel finansal ikiz</span>
          </div>
          <Link className="primary-landing-button" href="/login">
            Başla
            <ArrowRight size={17} />
          </Link>
        </footer>
      </main>
    </LandingMotion>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
