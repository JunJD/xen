"use client";

import { useEffect, useState } from "react";
import { CHROME_WEB_STORE_URL } from "./install-links";

type InstallExperience = {
  badge: string;
  ctaLabel: string;
  summary: string;
  helper: string;
  checklist: string[];
};

const defaultExperience: InstallExperience = {
  badge: "桌面浏览器",
  ctaLabel: "打开 Chrome 商店",
  summary: "Xen 已通过 Chrome Web Store 审核，安装会在官方商店内完成最后一步。",
  helper: "建议使用桌面版 Chrome 或 Edge 打开，安装后就能在任意英文网页里直接使用。",
  checklist: [
    "点击安装按钮后会打开官方商店页",
    "Chrome 用户确认“添加扩展”即可完成安装",
    "Edge 用户首次需要允许来自其他商店的扩展",
  ],
};

function detectInstallExperience(userAgent: string): InstallExperience {
  const normalizedUserAgent = userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/.test(normalizedUserAgent);
  const isEdge = /edg\//.test(normalizedUserAgent);
  const isChrome = /chrome\//.test(normalizedUserAgent) && !isEdge;

  if (isMobile) {
    return {
      badge: "桌面版可安装",
      ctaLabel: "打开安装链接",
      summary: "Xen 扩展目前只支持桌面版 Chrome 和 Edge，手机上可以先打开链接确认安装方式。",
      helper: "把安装链接发到你的电脑后打开，按商店提示完成一次安装即可。",
      checklist: [
        "桌面 Chrome 用户在 Chrome Web Store 中确认安装",
        "桌面 Edge 用户可用同一条链接继续安装",
        "安装完成后回到英文网页即可使用 Xen",
      ],
    };
  }

  if (isEdge) {
    return {
      badge: "已识别 Edge",
      ctaLabel: "在 Edge 中安装",
      summary: "同一条 Chrome Web Store 链接也能在 Edge 中安装 Xen，不需要单独的 Edge 包。",
      helper: "首次安装时，Edge 会先提示“允许来自其他商店的扩展”，确认一次即可。",
      checklist: [
        "点击后在新标签打开 Chrome Web Store",
        "先允许来自其他商店的扩展",
        "再点击“添加扩展”完成安装",
      ],
    };
  }

  if (isChrome) {
    return {
      badge: "已识别 Chrome",
      ctaLabel: "安装到 Chrome",
      summary: "你现在可以直接跳到 Chrome Web Store 完成官方安装，整个流程对普通用户最稳定。",
      helper: "Chrome 官方要求最后一步必须在商店内确认，所以官网按钮会把用户直接带过去。",
      checklist: [
        "点击安装后打开 Xen 的官方商店页",
        "确认“添加至 Chrome”并完成授权",
        "安装后在英文网页中直接开启 Xen",
      ],
    };
  }

  return {
    badge: "推荐 Chrome / Edge",
    ctaLabel: "打开 Chrome 商店",
    summary: "Xen 最佳安装路径是桌面版 Chrome 或 Edge，官网会直接把你带到官方安装页。",
    helper: "如果你现在不是在 Chrome 或 Edge 中，建议切换到这两个浏览器后再安装。",
    checklist: [
      "桌面 Chrome 用户可直接完成安装",
      "桌面 Edge 用户也能使用同一条链接安装",
      "安装完成后即可在英文网页中获得词汇释义和发音",
    ],
  };
}

export function InstallPanel() {
  const [experience, setExperience] = useState(defaultExperience);

  useEffect(() => {
    setExperience(detectInstallExperience(window.navigator.userAgent));
  }, []);

  return (
    <aside className="install-panel card">
      <div className="install-panel-head">
        <span className="install-panel-badge">{experience.badge}</span>
        <span className="install-panel-status">Chrome Web Store 已审核通过</span>
      </div>

      <div className="install-panel-copy">
        <h2 className="install-panel-title">先装上 Xen，再直接读英文网页。</h2>
        <p className="install-panel-summary">{experience.summary}</p>
      </div>

      <div className="install-panel-actions">
        <a
          className="install-panel-button"
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noreferrer"
        >
          {experience.ctaLabel}
        </a>
        <a className="install-panel-subaction" href="#install-guide">
          查看安装说明
        </a>
      </div>

      <p className="install-panel-helper">{experience.helper}</p>

      <ul className="install-panel-checklist">
        {experience.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
