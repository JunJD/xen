# 浏览器插件（对标 Relingo）数据库设计草案

本文基于“划词/句翻译、整页翻译、视频双语字幕、PDF 翻译、闪卡/复习、阅读进度、多语言词典、可配置设置”等核心体验给出数据库设计基线。若你的功能范围不同，请在“待确认问题”中反馈后再收敛。

## 1. 范围假设
- 多设备登录与同步。
- 订阅与配额管理。
- 内容类型包含网页、视频字幕、PDF。
- 支持多语言与多翻译引擎。

## 2. 数据模型概览
- 用户、设备、订阅与计费事件。
- 内容来源（网页/视频/PDF）与分段（句子/段落/字幕）。
- 词汇与释义、翻译结果、出现位置。
- 用户词汇进度、复习记录与阅读会话。
- 设置、快捷键、用量统计与缓存。

## 3. 逻辑表结构（精简版）

**账号与订阅**
- `users`: id, email, password_hash, locale, created_at
- `devices`: id, user_id, browser, install_id, last_seen_at
- `subscriptions`: id, user_id, plan, status, current_period_end, provider_ref
- `billing_events`: id, user_id, type, payload, created_at

**语言与词典**
- `languages`: id, code, name
- `lexemes`: id, language_id, lemma, pos, lemma_norm
- `senses`: id, lexeme_id, definition, domain, example
- `translations`: id, sense_id, target_language_id, text
- `word_lists`: id, language_id, name, level
- `lexeme_word_lists`: lexeme_id, word_list_id

**内容与上下文**
- `sources`: id, user_id, type(page/video/pdf), url, url_hash, title, domain, language_id, created_at
- `segments`: id, source_id, type(sentence/paragraph/subtitle), start_ms, end_ms, text, text_hash
- `segment_translations`: id, segment_id, engine, target_language_id, text, created_at
- `occurrences`: id, source_id, segment_id, lexeme_id, start_offset, end_offset

**学习与进度**
- `user_vocab`: user_id, lexeme_id, state(new/learning/known/ignored), familiarity, last_seen_at, times_seen
- `reviews`: id, user_id, lexeme_id, result, ease, reviewed_at
- `review_schedule`: user_id, lexeme_id, due_at, interval, ease

**阅读与行为**
- `reading_sessions`: id, user_id, source_id, started_at, ended_at, progress
- `highlights`: id, user_id, source_id, segment_id, note, created_at

**设置与个性化**
- `user_settings`: user_id, language_id, highlight_level, theme, show_subtitles, updated_at
- `user_shortcuts`: user_id, action, keys

**翻译与配额**
- `translation_cache`: text_hash, source_lang, target_lang, engine, result, created_at
- `usage_counters`: user_id, period, translations, subtitles, pdf_pages

## 4. 关键索引建议
- `user_vocab` 上 `(user_id, lexeme_id)` 唯一索引。
- `occurrences` 上 `(source_id, lexeme_id)` 索引，用于页面词汇统计。
- `segments` 上 `(source_id, type)` 索引，用于分段拉取。
- `sources` 上 `(user_id, url_hash)` 唯一索引（避免跨用户冲突/泄露）。
- `translation_cache` 上 `(text_hash, source_lang, target_lang, engine)` 唯一索引。

## 5. 本地与云端分工建议
- 本地扩展：`IndexedDB` 缓存 `segments`、`occurrences`、`user_vocab`；`storage` 里保存设置与轻量状态。
- 云端：权威数据源，处理同步、统计、订阅、跨设备一致性。
- 对象存储：PDF、字幕文件等大对象只存元数据在 DB。

## 6. 待确认问题
- 是否需要账号体系与多设备同步？
- 是否存在订阅付费与配额限制？
- 具体内容类型覆盖范围（网页、YouTube、PDF、播客等）？
- 是否需要团队/组织协作或多用户共享词库？

## 7. Prisma 版本
已生成 Prisma schema：`prisma/schema.prisma`。默认配置为 `postgresql`，id 使用 `uuid()`。如需 MySQL / SQLite / Mongo 或自定义 id 策略，请告知。

如果你给出明确范围，我可以输出 ERD（含基数关系）和建表 SQL 草案。
