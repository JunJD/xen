export default function HomePage() {
  return (
    <section className="landing-page">
      <p className="landing-eyebrow">Xen</p>
      <div className="landing-hero">
        <div className="landing-copy">
          <h1 className="landing-title">为阅读而设计的网页翻译。</h1>
          <p className="landing-summary">
            Xen 是面向 Chrome 的语言辅助扩展，提供翻译、词汇提示、语法高亮与账号同步。
          </p>

          <div className="landing-actions">
            <a className="landing-link" href="/privacy">
              查看隐私协议
            </a>
            <a className="landing-link landing-link-secondary" href="/sign-in">
              登录
            </a>
          </div>
        </div>

        <aside className="landing-side">
          <div className="landing-side-block">
            <p className="landing-side-label">审核固定链接</p>
            <a href="/privacy" className="landing-path">
              /privacy
            </a>
          </div>

          <div className="landing-side-block">
            <p className="landing-side-label">产品能力</p>
            <p className="landing-side-text">
              网页翻译、词汇辅助、语法高亮，以及网页登录与扩展会话同步。
            </p>
          </div>
        </aside>
      </div>

      <div className="landing-rule" />

      <div className="landing-details">
        <section className="landing-detail">
          <p className="landing-detail-index">01</p>
          <div>
            <h2>Translation</h2>
            <p>在网页阅读场景中提供轻量、即时的翻译体验。</p>
          </div>
        </section>

        <section className="landing-detail">
          <p className="landing-detail-index">02</p>
          <div>
            <h2>Vocabulary</h2>
            <p>通过词汇提示与词典能力，帮助用户保持上下文理解。</p>
          </div>
        </section>

        <section className="landing-detail">
          <p className="landing-detail-index">03</p>
          <div>
            <h2>Privacy</h2>
            <p>隐私协议使用固定路由，便于审核与外部访问。</p>
          </div>
        </section>
      </div>
    </section>
  );
}
