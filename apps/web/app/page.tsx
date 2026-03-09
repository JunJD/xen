import type { Metadata } from "next";

type PrivacySection = {
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export const metadata: Metadata = {
  title: "Xen 用户隐私协议",
  description: "Xen Chrome 扩展与关联登录页面的隐私政策。",
};

const lastUpdated = "2026年3月9日";
const appVersion = "0.1.0";

const privacySections: PrivacySection[] = [
  {
    title: "1. 本政策适用范围",
    paragraphs: [
      "本页面是 Xen 当前版本的用户隐私协议（Privacy Policy），适用于 Xen Chrome 扩展，以及 Xen 用于登录/注册的关联网页。",
      "如果你在使用 Xen 过程中访问了登录页面、启用了账号同步，或使用了翻译与高亮能力，本政策描述了 Xen 处理相关数据的方式。",
    ],
  },
  {
    title: "2. 我们会处理哪些信息",
    items: [
      "账号与认证信息：当你主动登录或注册时，Xen 会通过 Clerk 处理邮箱地址、登录状态、会话标识等认证相关信息。",
      "本地设置与偏好：例如默认模式、忽略名单、标注样式、高亮样式、词典选择、侧边栏位置、翻译模型配置等，这些信息主要保存在你的浏览器本地存储或扩展存储中。",
      "页面内容与上下文：为了提供网页翻译、语法/词汇高亮等功能，Xen 可能处理当前网页中的文本片段、当前页面 URL，或与翻译请求直接相关的上下文信息。",
      "你主动填写的数据：如果你启用 LLM/OpenAI 翻译并手动填写 API Key，该密钥会保存在浏览器扩展存储中，用于完成你发起的翻译请求。",
      "认证相关 Cookie：当你使用 Xen 的网页登录能力时，相关认证 Cookie 可能被用于维持登录状态以及同步网页与扩展的认证状态。",
    ],
  },
  {
    title: "3. 我们如何使用这些信息",
    items: [
      "提供账号登录、注册、登出与会话同步能力。",
      "保存你的功能设置，并在你再次打开浏览器或扩展时恢复偏好。",
      "在你浏览网页时提供词汇/语法高亮、词典辅助和翻译预览。",
      "在你主动触发翻译时，将必要的文本发送到你选择的翻译服务提供方以返回结果。",
      "排查功能故障、提升稳定性，并防止功能被滥用。",
    ],
  },
  {
    title: "4. 第三方服务与数据共享",
    paragraphs: [
      "Xen 只会在提供对应功能所必需的范围内与第三方服务交互，不会因为单纯安装扩展而向所有第三方持续发送你的浏览数据。",
    ],
    items: [
      "Clerk：用于用户登录、注册和认证状态管理。",
      "Google Translate：当你使用 Google 翻译能力时，请求中涉及的文本会发送给 Google 的翻译接口。",
      "OpenAI：当你主动启用 LLM/OpenAI 翻译并提供自己的 API Key 后，请求中涉及的文本会发送给 OpenAI，以生成翻译结果。",
    ],
  },
  {
    title: "5. 数据保存与控制",
    items: [
      "保存在浏览器本地或扩展存储中的设置，一般会保留到你主动修改、清除浏览器数据或卸载扩展为止。",
      "如果你不希望 Xen 处理登录信息，可以不登录，或在使用后主动退出账号。",
      "如果你不希望文本被发送到第三方翻译服务，请不要启用对应翻译能力，或切换为你信任的服务。",
      "你可以通过浏览器的扩展管理、站点数据清理或本地存储清理方式删除已保存的本地数据。",
      "第三方服务接收到的数据，受其各自隐私政策与保留规则约束。",
    ],
  },
  {
    title: "6. 我们不会做什么",
    items: [
      "不会出售你的个人信息。",
      "不会在与你主动使用的功能无关的情况下，持续收集或共享你的网页内容。",
      "不会在你未启用对应翻译能力时，将翻译文本发送给 OpenAI 或 Google Translate。",
    ],
  },
  {
    title: "7. 政策更新与联系方式",
    paragraphs: [
      "如果 Xen 的数据处理方式发生变化，我们会更新本页面，并同步调整“最后更新”日期。",
      "如果你对本政策有疑问、需要反馈隐私问题，或希望申请删除本地可清除范围外的数据，请通过下方方式联系开发者。",
    ],
  },
];

export default function HomePage() {
  return (
    <article className="card policy-page">
      <p className="policy-eyebrow">Xen Privacy Policy</p>
      <h1 className="policy-title">Xen 用户隐私协议</h1>
      <p className="policy-summary">
        本页面为 Xen 当前版本可直接访问的隐私政策页面，用于说明 Xen Chrome
        扩展及其关联登录网页如何处理用户数据。
      </p>

      <div className="policy-meta" aria-label="policy metadata">
        <span className="policy-pill">版本：{appVersion}</span>
        <span className="policy-pill">最后更新：{lastUpdated}</span>
      </div>

      {privacySections.map((section) => (
        <section key={section.title} className="policy-section">
          <h2>{section.title}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.items?.length ? (
            <ul className="policy-list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <section className="policy-section">
        <h2>开发者联系方式</h2>
        <ul className="policy-list">
          <li>
            开发者：丁俊杰
          </li>
          <li>
            邮箱：
            <a href="mailto:864546065@qq.com">864546065@qq.com</a>
          </li>
          <li>
            GitHub：
            <a
              href="https://github.com/JunJD"
              target="_blank"
              rel="noreferrer"
            >
              https://github.com/JunJD
            </a>
          </li>
        </ul>
      </section>

      <div className="policy-note">
        Xen 的基础功能依赖浏览器本地存储；登录能力依赖 Clerk；翻译能力可能依赖
        Google Translate 或 OpenAI。只有在你主动使用对应功能时，相关数据才会
        按功能需要被处理。
      </div>
    </article>
  );
}
