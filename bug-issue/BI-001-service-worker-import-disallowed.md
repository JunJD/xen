# BI-001: Service Worker 中直接跑 Pyodide 失败

状态: 已修复  
修复日期: 2026-02-13

## 现象

- 初始化报错: `import() is disallowed on ServiceWorkerGlobalScope`。
- 模型无法进入可用状态，popup 一直停留在初始化或错误状态。

## 根因

- MV3 `service_worker` 环境不适合直接承载 Pyodide 运行时。
- Pyodide 初始化涉及 wasm / 动态加载，和 Service Worker 执行模型冲突。

## 修复方案

- 引入 Offscreen Document 承载 Pyodide 与 spaCy 初始化。
- `background` 只做协调与转发，不直接执行 Pyodide。

## 关键改动文件

- `entrypoints/offscreen/main.ts`
- `entrypoints/offscreen/index.html`
- `lib/pickup/offscreen-protocol.ts`
- `entrypoints/background.ts`

## 验收标准

1. 扩展加载后可创建/复用 offscreen 文档。
2. 初始化与分析请求通过消息转发到 offscreen 执行。
3. 不再出现 `import() is disallowed on ServiceWorkerGlobalScope`。

## 回归测试用例

1. 打开扩展 popup，观察模型状态能从 `idle/initializing` 变化。
2. 在有英文段落的页面触发分析，请求能返回 token 列表（允许为空数组）。
3. 重启浏览器后再次打开扩展，不出现 Service Worker import 限制报错。
