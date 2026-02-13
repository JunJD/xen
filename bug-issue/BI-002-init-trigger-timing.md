# BI-002: 模型初始化只在打开 Popup 后触发

状态: 已修复  
修复日期: 2026-02-13

## 现象

- 未打开 popup 时模型保持未初始化状态。
- 首次打开 popup 需要等待较长时间，体验不稳定。

## 根因

- 初始化触发点放在 popup 生命周期里，导致“按需初始化”而不是“预热初始化”。

## 修复方案

- 在 `background` 中增加统一预热入口。
- 通过 `onInstalled`、`onStartup` 以及后台启动时机触发 `warmup`。
- 预热请求统一转发到 offscreen 执行。

## 关键改动文件

- `entrypoints/background.ts`
- `entrypoints/offscreen/main.ts`
- `lib/pickup/messaging.ts`

## 验收标准

1. 浏览器启动/扩展安装后会自动触发模型预热。
2. 首次打开 popup 时，状态通常已进入初始化中后段或 ready。
3. 重复触发 warmup 不会并发风暴（有 in-flight 保护）。

## 回归测试用例

1. 安装扩展后不打开 popup，等待 5-15 秒，再打开 popup，确认状态已有进展。
2. 浏览器重启后重复上述流程，确认行为一致。
3. 高频点击触发状态查询，后台不出现大量重复 warmup 初始化。
