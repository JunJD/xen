# Bug Issue Log

更新时间: 2026-02-13

用于记录本阶段已修复的 bug，便于后续复盘和回归测试。

## 已记录问题

1. `BI-001` Service Worker 中直接运行 Pyodide 初始化失败
   文件: `bug-issue/BI-001-service-worker-import-disallowed.md`
2. `BI-002` 模型初始化只在打开 popup 后才触发
   文件: `bug-issue/BI-002-init-trigger-timing.md`
3. `BI-003` 模型未就绪时 UI 状态不明确
   文件: `bug-issue/BI-003-popup-loading-progress.md`
4. `BI-004` 分析失败时返回值不稳定导致上层处理复杂
   文件: `bug-issue/BI-004-analyze-fallback-empty-array.md`
5. `BI-005` WebAssembly 被扩展 CSP 阻断
   文件: `bug-issue/BI-005-wasm-csp-block.md`
6. `BI-006` Pyodide 加载链路不稳定导致 `Module.pyproxy_new` 错误
   文件: `bug-issue/BI-006-pyodide-loader-mismatch.md`
7. `BI-007` spaCy bootstrap 未对齐 `spacy-wasm/script.js` 导致初始化链路异常
   文件: `bug-issue/BI-007-spacy-bootstrap-alignment.md`

## 复盘建议

1. 先看 `BI-001` 和 `BI-005`，这是运行时基础问题。
2. 再看 `BI-002` 和 `BI-003`，这是初始化体验问题。
3. 再看 `BI-004`，这是接口稳定性问题。
4. 再看 `BI-006` 与 `BI-007`，这是加载链路一致性问题。
