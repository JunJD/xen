import type { CSSProperties, ReactNode } from "react";
import { PronunciationChip } from "./pronunciation-button";

const infoboxSections = [
  {
    title: "Major goals",
    items: ["Learning", "Reasoning", "Perception"],
  },
  {
    title: "Approaches",
    items: ["Machine learning", "Deep learning", "Knowledge graphs"],
  },
  {
    title: "Applications",
    items: ["Search", "Translation", "Education"],
  },
];

const demoRuntimePills = ["原文保留", "词汇注释", "段落译文", "点击发音"];

const heroBenefits = ["原网页直接阅读", "词汇释义", "点击发音", "段落译文"];

type MockPickupTokenProps = {
  original: string;
  translated: string;
  title: string;
  active?: boolean;
  accentColor?: string;
  softBgColor?: string;
  highlightClass?: string;
};

function MockPickupToken({
  original,
  translated,
  title,
  active = false,
  accentColor = "#ff7a00",
  softBgColor = "rgba(255, 122, 0, 0.12)",
  highlightClass = "xen-pickup-highlight-marker",
}: MockPickupTokenProps) {
  const style = {
    "--xen-pickup-accent": accentColor,
    "--xen-pickup-soft-bg": softBgColor,
  } as CSSProperties;

  return (
    <span
      className={[
        "xen-pickup-token-host",
        "xen-pickup-token",
        "xen-pickup-token-vocabulary",
        "xen-pickup-token-translated",
        "xen-pickup-annotation-top",
        highlightClass,
        "xen-pickup-theme-light",
        active ? "xen-pickup-token-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-demo-element="xen-pickup-token-wc"
      data-pickup-ignore="true"
      data-pickup-token-original={original}
      title={title}
      aria-expanded={active ? "true" : "false"}
      style={style}
    >
      <span className="xen-token-root">
        <ruby className="xen-token-origin">
          <span className="xen-token-origin-text">{original}</span>
          <rt className="xen-token-annotation-top">{translated}</rt>
        </ruby>
        <span className="xen-token-annotation-right">{translated}</span>
      </span>
    </span>
  );
}

type MockTooltipPhone = {
  text: string;
  lang: string;
  region: string;
  value: string;
};

type MockInteractivePickupTokenProps = MockPickupTokenProps & {
  tooltipId: string;
  description: string;
  phones?: MockTooltipPhone[];
};

function MockInteractivePickupToken({
  tooltipId,
  description,
  phones = [],
  original,
  translated,
  title,
  active = false,
  accentColor,
  softBgColor,
  highlightClass,
}: MockInteractivePickupTokenProps) {
  return (
    <span className="demo-inline-tooltip-anchor" data-pickup-ignore="true">
      <button
        type="button"
        className="demo-inline-tooltip-trigger"
        aria-label={`查看 ${original} 的释义${phones.length > 0 ? "和发音" : ""}`}
        aria-describedby={tooltipId}
      >
        <MockPickupToken
          original={original}
          translated={translated}
          title={title}
          active={active}
          accentColor={accentColor}
          softBgColor={softBgColor}
          highlightClass={highlightClass}
        />
      </button>
      <span className="demo-inline-tooltip">
        <span className="tippy-box" data-theme="xen-pickup" id={tooltipId} role="tooltip">
          <span className="tippy-content">
            <span className="xen-pickup-tooltip">
              <span className="xen-pickup-tooltip-lines">
                {phones.length > 0 ? (
                  <span className="xen-pickup-tooltip-line xen-pickup-tooltip-line-phone">
                    {phones.map((phone) => (
                      <PronunciationChip
                        key={`${tooltipId}-${phone.region}`}
                        text={phone.text}
                        lang={phone.lang}
                        region={phone.region}
                        value={phone.value}
                      />
                    ))}
                  </span>
                ) : null}
                <span className="xen-pickup-tooltip-line xen-pickup-tooltip-line-desc">
                  {description}
                </span>
              </span>
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

function DemoParagraph({
  paragraphId,
  original,
  translation,
  children,
}: {
  paragraphId: string;
  original: string;
  translation: string;
  children: ReactNode;
}) {
  return (
    <>
      <p
        className="demo-wiki-paragraph"
        data-pickup-original={original}
        data-pickup-id={paragraphId}
        data-pickup-status="done"
        data-pickup-processed="true"
        data-pickup-annotated="true"
      >
        {children}
      </p>
      <span
        className="xen-pickup-paragraph-translation"
        data-pickup-ignore="true"
        data-pickup-translation-paragraph="true"
        data-pickup-translation-owner-id={paragraphId}
      >
        {translation}
      </span>
    </>
  );
}

export default function HomePage() {
  return (
    <section className="landing-page">
      <header className="landing-intro">
        <h1 className="landing-title">把英文网页直接变成可读的第二语言。</h1>
        <p className="landing-summary">在你原本浏览的英文网页里，边读边懂，不打断阅读节奏。</p>

        <div className="landing-actions">
          <a className="landing-link landing-link-primary" href="#demo">
            查看演示
          </a>
          <a className="landing-link" href="/privacy">
            查看隐私协议
          </a>
          <a className="landing-link landing-link-secondary" href="/sign-in">
            登录
          </a>
        </div>

        <div className="landing-benefits" aria-label="功能特点">
          {heroBenefits.map((benefit) => (
            <span className="landing-benefit" key={benefit}>
              {benefit}
            </span>
          ))}
        </div>
      </header>

      <section className="landing-demo" id="demo">
        <div className="landing-demo-head">
          <p className="landing-section-eyebrow">效果预览</p>
          <h2 className="landing-section-title">打开 Xen 后，网页会像下面这样继续读下去。</h2>
        </div>

        <div className="landing-demo-grid">
          <div className="card demo-browser">
            <div className="demo-browser-top">
              <div className="demo-browser-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span className="demo-browser-url">en.wikipedia.org/wiki/Artificial_intelligence</span>
              <span className="demo-browser-badge">Xen 已开启</span>
            </div>

            <div className="demo-browser-content">
              <div
                className="demo-wiki-shell"
                data-xen-pickup-annotation-style="top"
                data-xen-pickup-highlight-style="marker"
                data-xen-pickup-theme="light"
                data-xen-pickup-mode="vocab_infusion"
                data-xen-pickup-translation-line-enabled="true"
                data-xen-pickup-translation-blur="false"
              >
                <div className="demo-runtime-pills" data-pickup-ignore="true">
                  {demoRuntimePills.map((pill) => (
                    <span className="demo-runtime-pill" key={pill}>
                      {pill}
                    </span>
                  ))}
                </div>

                <div
                  className="demo-wiki-note"
                  role="note"
                  data-pickup-original='"AI" redirects here. For other uses, see AI (disambiguation).'
                  data-pickup-id="xen-pickup-demo-note"
                  data-pickup-status="done"
                  data-pickup-processed="true"
                  data-pickup-annotated="true"
                >
                  &quot;
                  <MockPickupToken original="AI" translated="人工智能" title="同位语" />
                  &quot; redirects here. For{" "}
                  <MockPickupToken original="other" translated="别的" title="形容修饰" /> uses, see AI
                  (disambiguation).
                </div>

                <div className="demo-wiki-layout">
                  <aside className="demo-wiki-infobox">
                    <p
                      className="demo-wiki-infobox-pretitle"
                      data-pickup-original="Part of a series on"
                      data-pickup-id="xen-pickup-demo-pretitle"
                      data-pickup-status="done"
                      data-pickup-processed="true"
                      data-pickup-annotated="true"
                    >
                      Part of a series on
                    </p>
                    <h4
                      className="demo-wiki-infobox-title"
                      data-pickup-original="Artificial intelligence (AI)"
                      data-pickup-id="xen-pickup-demo-title"
                      data-pickup-status="done"
                      data-pickup-processed="true"
                      data-pickup-annotated="true"
                    >
                      <MockPickupToken original="Artificial" translated="人造的" title="形容修饰" />{" "}
                      intelligence (<MockPickupToken original="AI" translated="人工智能" title="同位语" />)
                    </h4>

                    {infoboxSections.map((section) => (
                      <div className="demo-wiki-infobox-group" key={section.title}>
                        <p className="demo-wiki-infobox-group-title">{section.title}</p>
                        <ul className="demo-wiki-infobox-list">
                          {section.items.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </aside>

                  <article className="demo-wiki-article">
                    <h3 className="demo-wiki-article-title">Artificial intelligence</h3>

                    <DemoParagraph
                      paragraphId="xen-pickup-demo-paragraph-1"
                      original="Artificial intelligence (AI) is the capability of computational systems to perform tasks typically associated with human intelligence."
                      translation="人工智能（AI）是计算系统执行通常与人类智能相关任务的能力。"
                    >
                      <strong>
                        <MockInteractivePickupToken
                          tooltipId="demo-artificial-tooltip"
                          original="Artificial"
                          translated="人造的"
                          title="形容修饰"
                          description="人造的；在这里表示并非自然形成，而是由人设计或构建。"
                          phones={[
                            {
                              text: "Artificial",
                              lang: "en-US",
                              region: "US",
                              value: "/ˌɑːr.t̬əˈfɪʃ.əl/",
                            },
                            {
                              text: "Artificial",
                              lang: "en-GB",
                              region: "UK",
                              value: "/ˌɑː.tɪˈfɪʃ.əl/",
                            },
                          ]}
                        />
                      </strong>{" "}
                      intelligence (AI) is the{" "}
                      <MockInteractivePickupToken
                        tooltipId="demo-capability-tooltip"
                        original="capability"
                        translated="能力"
                        title="系表"
                        description="能力；这里指一个系统能够完成某类任务的本领。"
                        phones={[
                          {
                            text: "capability",
                            lang: "en-US",
                            region: "US",
                            value: "/ˌkeɪ.pəˈbɪl.ə.t̬i/",
                          },
                          {
                            text: "capability",
                            lang: "en-GB",
                            region: "UK",
                            value: "/ˌkeɪ.pəˈbɪl.ə.ti/",
                          },
                        ]}
                      />{" "}
                      of{" "}
                      <MockInteractivePickupToken
                        tooltipId="demo-computational-tooltip"
                        original="computational"
                        translated="计算的"
                        title="形容修饰"
                        description="计算的；用于描述依赖计算过程、算法或算力完成任务。"
                        phones={[
                          {
                            text: "computational",
                            lang: "en-US",
                            region: "US",
                            value: "/ˌkɑːm.pjəˈteɪ.ʃən.əl/",
                          },
                          {
                            text: "computational",
                            lang: "en-GB",
                            region: "UK",
                            value: "/ˌkɒm.pjʊˈteɪ.ʃən.əl/",
                          },
                        ]}
                      />{" "}
                      systems to perform tasks typically associated with human intelligence.
                    </DemoParagraph>

                    <DemoParagraph
                      paragraphId="xen-pickup-demo-paragraph-2"
                      original="High-profile applications of AI include advanced web search engines, recommendation systems, virtual assistants, and generative tools."
                      translation="AI 的高知名度应用包括先进搜索引擎、推荐系统、虚拟助手和生成式工具。"
                    >
                      <MockInteractivePickupToken
                        tooltipId="demo-high-profile-tooltip"
                        original="High-profile"
                        translated="高知名度的"
                        title="形容修饰"
                        description="高知名度的；指社会曝光度高、被广泛讨论或关注。"
                      />{" "}
                      applications of AI include{" "}
                      <MockInteractivePickupToken
                        tooltipId="demo-advanced-tooltip"
                        original="advanced"
                        translated="先进的"
                        title="形容修饰"
                        description="先进的；表示技术或方法处在较新、更成熟的阶段。"
                        phones={[
                          {
                            text: "advanced",
                            lang: "en-US",
                            region: "US",
                            value: "/ədˈvænst/",
                          },
                          {
                            text: "advanced",
                            lang: "en-GB",
                            region: "UK",
                            value: "/ədˈvɑːnst/",
                          },
                        ]}
                      />{" "}
                      web search engines, recommendation systems, virtual assistants, and{" "}
                      <MockInteractivePickupToken
                        tooltipId="demo-generative-tooltip"
                        original="generative"
                        translated="生成式的"
                        title="形容修饰"
                        description="能产生的；在这里指能够生成文本、图像或音频内容的。"
                        phones={[
                          {
                            text: "generative",
                            lang: "en-US",
                            region: "US",
                            value: "/ˈdʒen.ər.ə.t̬ɪv/",
                          },
                          {
                            text: "generative",
                            lang: "en-GB",
                            region: "UK",
                            value: "/ˈdʒen.ər.ə.tɪv/",
                          },
                        ]}
                      />{" "}
                      tools.
                    </DemoParagraph>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
