# BI-007: spaCy bootstrap 未对齐 `spacy-wasm/script.js` 导致初始化链路异常

状态: 已修复
修复日期: 2026-02-13

## 现象

- popup 持续报错:
  - `Cannot use 'in' operator to search for 'Module.pyproxy_new' in undefined`
- 初始化会在早期阶段失败，导致持续重试。

## 根因

- `xen` 中的 spaCy 初始化链路与 `G:\repo\spacy-wasm\script.js` 不一致。
- `public/spacy/visualize.py` 缺失，运行时无法按预期执行 Python bootstrap。
- 初始化参数和步骤偏复杂，增加了 Pyodide 在扩展环境中的不确定性。

## 修复方案

1. 新增 `public/spacy/visualize.py`，按 `spacy-wasm` 的方式完成:
   - `micropip` 安装本地 wheels
   - `_get_nlp()` 缓存模型
   - `analyze(text)` 返回 JSON 字符串
2. 重写 `lib/pickup/spacy/analyzer.ts` 初始化链路，对齐 `script.js`:
   - 从 `globalThis.loadPyodide` 获取入口
   - `loadPyodide({ indexURL })`
   - `pyodide.loadPackage(['micropip'])`
   - `fetch('/spacy/visualize.py') + runPythonAsync`
   - `pyodide.globals.get('analyze')`
3. 保留模型状态进度更新与失败信息透传，便于 popup 显示和排查。

## 关键改动文件

- `lib/pickup/spacy/analyzer.ts`
- `public/spacy/visualize.py`

## 验收标准

1. 初始化不再因缺失 bootstrap 脚本直接失败。
2. `status/progress/stage` 能持续推进到 `ready`（或提供明确失败原因）。
3. 分析接口失败时返回空数组（由上层处理），不会抛出未捕获异常。

## 回归测试用例

1. 重新加载扩展后，不打开 popup，后台应自动触发 warmup。
2. 打开 popup，观察 loading 进度从 `waiting/initializing` 推进到 `ready`。
3. 输入英文段落触发分析，确认返回 token 数组；失败场景下返回空数组。
4. 重复刷新扩展 3 次，确认初始化链路行为稳定。

## 验证结果（本地）

- `pnpm compile` 通过。
- `pnpm build` 因系统锁定 `.output/chrome-mv3/pyodide/pyodide.asm.data` 失败（`EBUSY`），需释放文件占用后再验收构建。
