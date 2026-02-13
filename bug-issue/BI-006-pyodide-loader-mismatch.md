# BI-006: `Module.pyproxy_new` 空引用导致初始化反复失败

状态: 已修复  
修复日期: 2026-02-13

## 现象

- popup 持续显示:
  - `重试中: Cannot use 'in' operator to search for 'Module.pyproxy_new' in undefined`
- 初始化经常停在早期阶段（通常在 Pyodide 核心加载附近）。

## 根因

- 原实现走了包内模块导入链路，运行时与 offscreen 实际资源加载方式存在差异。
- 导致 Pyodide 内部 `Module` 未正确就绪，触发 `pyproxy_new` 相关空引用。

## 修复方案（对齐上级 `spacy-wasm`）

- Offscreen 页面先显式加载 `pyodide.js`，让 `loadPyodide` 以全局函数方式注入。
- 分析器改为从 `globalThis.loadPyodide` 读取入口，不再依赖模块导入。
- 增加运行时结构校验（`runPythonAsync/FS/globals.get`）并给出明确错误码。

## 关键改动文件

- `entrypoints/offscreen/index.html`
- `lib/pickup/spacy/analyzer.ts`

## 验收标准

1. 不再出现 `Module.pyproxy_new` 相关错误。
2. 初始化进度可从 8% 继续推进到后续阶段。
3. 构建日志中不再出现此前由 pyodide 包导入引起的浏览器兼容告警。

## 回归测试用例

1. 冷启动扩展并打开 popup，观察初始化是否持续推进。
2. 多次手动重载扩展，确认不再反复触发该错误。
3. 触发一次文本分析，确认能稳定返回 token 数组（可为空）。
