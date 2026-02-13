# BI-005: WebAssembly 初始化被 CSP 阻断

状态: 已修复  
修复日期: 2026-02-13

## 现象

- 报错包含:
  - `WebAssembly.instantiateStreaming() ... violates Content Security Policy`
  - `failed to asynchronously prepare wasm`
  - `Pyodide spaCy initialization failed`
- 初始化进度停在早期阶段（例如 8%）。

## 根因

- 扩展 `manifest` 未为 extension pages 声明 wasm 运行所需 CSP。
- Pyodide 在初始化 wasm 模块时被浏览器策略拒绝。

## 修复方案

- 在 WXT manifest 配置中增加:
  - `content_security_policy.extension_pages = "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"`
- 重新构建并重载扩展使新 manifest 生效。

## 关键改动文件

- `wxt.config.ts`
- `.output/chrome-mv3/manifest.json`（构建产物验证）

## 验收标准

1. manifest 中可见 `content_security_policy.extension_pages` 包含 `'wasm-unsafe-eval'`。
2. 不再出现 wasm CSP 拦截报错。
3. 初始化可继续推进到模型文件下载与加载阶段。

## 回归测试用例

1. 冷启动后观察状态是否跨过 8% 阶段继续前进。
2. 打开扩展错误日志，确认无 wasm CSP violation。
3. 升级代码后重新构建并重载扩展，重复验证一次。

## 若仍卡在 8% 的排查顺序

1. 确认当前加载的扩展是最新构建产物（不是旧版本缓存）。
2. 在扩展详情页执行“重新加载”，再重新打开 popup。
3. 检查实际生效的 manifest 是否包含 CSP 字段与 `'wasm-unsafe-eval'`。
