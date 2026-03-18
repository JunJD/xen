# Xen

[English](./README.md) | 简体中文

> 一个帮助你在原网页中阅读英文的 Chrome 扩展，提供词汇释义、点击发音和段落译文。

[官网](https://www.xen2.tech/) · [Chrome Web Store](https://chromewebstore.google.com/detail/xen/dlckfhnjphdgdpgenljcbdocpenadfcf?hl=zh) · [隐私政策](https://www.xen2.tech/privacy)

## Xen 能做什么

- 直接在原网页中阅读英文内容，不需要跳到单独的阅读器。
- 为生词提供行内词汇提示，减少阅读被打断的次数。
- 支持点击发音，边读边听。
- 在需要完整上下文时提供段落级译文。

## 示例

| ProseMirror 文档 | MDN CSS 文档 | React 文档 |
| --- | --- | --- |
| <img src="apps/web/public/readme-prosemirror.png" alt="Xen 在 ProseMirror 文档中的效果" width="100%"> | <img src="apps/web/public/readme-mdn-css.png" alt="Xen 在 MDN CSS 文档中的效果" width="100%"> | <img src="apps/web/public/readme-react-docs.png" alt="Xen 在 React 文档中的效果" width="100%"> |

## Monorepo 结构

- `apps/extension`：基于 WXT 的浏览器扩展。
- `apps/web`：基于 Next.js 的官网与隐私页面。
- `packages`：工作区共享包。

## 开发

```bash
pnpm install
pnpm dev:extension
```

如果要启动官网：

```bash
pnpm dev:web
```

扩展的专用开发说明见 [`apps/extension/README.md`](apps/extension/README.md)。
