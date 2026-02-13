# 缓存策略（xen / pickup）

## 目标
- 降低重复分析成本（后续接入大模型时尤为关键）。
- 避免无限增长导致存储膨胀。
- 保证模型/版本变更时缓存不会“错用”。

## 核心策略
- **多层缓存**：内存层（热数据） + Dexie（持久层），查询自上而下，命中后回填上层。
- **Key 设计**：`cacheKey = sha256(modelKey + '|' + sourceHash)`
  - `sourceHash` 默认是段落文本的 `sha256`。
  - `modelKey` 用于隔离不同模型或版本的结果。
- **条目元数据**：每条缓存带 `version / modelKey / updatedAt / lastAccessed`。
- **命中校验**：只有 `version`、`modelKey` 都一致且未过期才命中。
- **过期策略（TTL）**：默认 30 天。
- **容量上限 + LRU**：超过上限时按 `lastAccessed` 从旧到新淘汰。

## 触发清理的时机
- **启动时**：触发一次清理。
- **写入后**：有新缓存写入时触发清理（节流）。
- **节流间隔**：默认 30 分钟内只清理一次，避免频繁 I/O。

## 关键参数（默认值）
位置：`lib/pickup/cache/pickup-cache.ts`
- `DEFAULT_PICKUP_CACHE_POLICY.ttlMs = 30 days`
- `DEFAULT_PICKUP_CACHE_POLICY.maxEntries = 5000`
- `DEFAULT_PICKUP_CACHE_POLICY.pruneIntervalMs = 30 minutes`
- `DEFAULT_PICKUP_CACHE_POLICY.accessUpdateIntervalMs = 5 minutes`
- `DEFAULT_PICKUP_CACHE_POLICY.entryVersion = 1`
- `DEFAULT_PICKUP_CACHE_MODEL_KEY = 'spacy-pyodide-0.21.3'`

## 何时需要调整
- **模型升级/切换**：更新 `DEFAULT_PICKUP_CACHE_MODEL_KEY` 或改成动态来源。
- **结果格式变化**：递增 `DEFAULT_PICKUP_CACHE_POLICY.entryVersion` 以整体失效旧缓存。
- **存储压力大**：调小 `DEFAULT_PICKUP_CACHE_POLICY.maxEntries` 或 `DEFAULT_PICKUP_CACHE_POLICY.ttlMs`。

## 后续接入大模型建议
- 将 `modelKey` 设计为 `provider:model:version`，例如：
  - `openai:gpt-4.1:2025-01-15`
  - `anthropic:claude-3.5-sonnet:2025-02-01`
- 如果支持多模型并存，建议在请求时携带 `modelKey`，由缓存层用 `cacheKey` 进行隔离。
- 需要接远端缓存时，在 `createPickupCache` 里替换/追加自定义 `layers` 即可。
