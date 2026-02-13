# BI-003: 模型未就绪时 Popup 缺少明确加载态

状态: 已修复  
修复日期: 2026-02-13

## 现象

- 用户无法区分“正在初始化”与“初始化失败可重试”。
- 进度不可见，定位问题成本高。

## 根因

- popup 未持续轮询模型状态，且缺少统一状态字段展示（`status/stage/progress/error`）。

## 修复方案

- popup 启动后先触发 warmup，再轮询模型状态。
- 在 `modelStatus.status !== ready` 时保持 loading 视图。
- 展示阶段文案、百分比进度、错误信息和自动重试状态。

## 关键改动文件

- `entrypoints/popup/App.tsx`
- `lib/pickup/messages.ts`
- `entrypoints/background.ts`

## 验收标准

1. 模型未就绪期间，popup 始终显示 loading 区域。
2. 页面展示 `status/stage/progress`，并随初始化过程更新。
3. 模型 ready 后自动切换到正常业务 UI。

## 回归测试用例

1. 冷启动扩展，观察 popup 从 loading 到 ready 的完整状态流。
2. 人为制造初始化失败（例如删掉模型文件）后，能看到错误文案与重试状态。
3. 恢复资源后，状态可从 error 回到 ready。
