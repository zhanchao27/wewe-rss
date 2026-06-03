# 测试文件夹分类说明

> 最后更新: 2026-06-01
> 说明: 本文件用于说明 test/ 文件夹的分类结构，文件未移动

---

## 📁 文件夹结构

```
test/
├── 📊 01-day-tests/           # Day 1-9 渐进测试脚本
├── ⚡ 02-pressure-tests/        # 压力测试脚本
├── 🔍 03-check-verify/         # 检查与验证脚本
├── 📈 04-reports-analysis/     # 报告与分析脚本
├── 🎭 05-simulate/             # 模拟脚本
├── 🔧 06-utilities/           # 工具脚本
├── ⚙️ 07-test-config/          # 测试配置
└── 📂 data/                    # 测试数据
```

---

## 📊 01-day-tests/ - Day 1-9 渐进测试脚本

| 文件 | 用途 | 日期 |
|------|------|------|
| run-day1-test.js | 基线测试 - 3公众号×5篇 | 2026-05-24 |
| run-day2-test.js | 增量测试 - 3公众号×10篇 | 2026-05-25 |
| run-day3-test.js | 极限测试 - 3公众号×15篇 | 2026-05-26 |
| run-day4-test.js | 小批量测试 - 10公众号×10篇 | 2026-05-27 |
| run-day5-test.js | 中批量测试 - 20公众号×10篇 | 2026-05-28 |
| run-day6-test.js | 大批量测试 - 40公众号×10篇 | 2026-05-29 |
| run-day7-test.js | 长间隔测试 - 8公众号×10篇 (45-90秒) | 2026-05-30 |
| run-day8-test.js | 标准间隔测试 - 8公众号×10篇 (30-60秒) | 2026-05-31 |
| run-day9-test.js | 短间隔测试 - 8公众号×10篇 (20-40秒) | 2026-06-01 |

**说明**: 核心测试脚本，完成 Phase 1-3 全部测试

---

## ⚡ 02-pressure-tests/ - 压力测试脚本

| 文件 | 用途 |
|------|------|
| pressure-test.js | 基础压力测试脚本 |
| pressure-test-scheme-b.js | 方案B压力测试 |
| pressure-test-9day.js | 9天渐进压力测试 |
| comprehensive-pressure-test.js | 综合压力测试 |

**说明**: 历史压力测试版本，现已被 Day 测试替代

---

## 🔍 03-check-verify/ - 检查与验证脚本

| 文件 | 用途 |
|------|------|
| check-feeds.js | 检查订阅源状态 |
| check-article-content.js | 检查文章内容完整性 |
| check-extraction-logs.js | 检查提取日志 |
| check-recent-articles.js | 检查最近文章 |
| check-schema.js | 检查数据库Schema |
| verify-database.js | 验证数据库状态 |
| test-article-content-fetch.js | 测试文章内容抓取 |
| test-random-accounts.js | 测试随机账号 |
| test-recent-articles.js | 测试最近文章 |
| test-mixed-links.js | 测试混合链接 |
| test-search.js | 测试搜索功能 |
| test-all-tables.js | 测试所有数据表 |

**说明**: 用于检查和验证系统各组件状态的脚本

---

## 📈 04-reports-analysis/ - 报告与分析脚本

| 文件 | 用途 |
|------|------|
| daily-report.js | 生成每日报告 |
| monitor-report.js | 监控报告 |
| content-quality-analyzer.js | 内容质量分析 |
| database-full-report.js | 数据库完整报告 |

**说明**: 用于生成测试报告和分析结果的脚本

---

## 🎭 05-simulate/ - 模拟脚本

| 文件 | 用途 |
|------|------|
| simulate-fulltext-storage.js | 模拟全文存储 |
| hybrid-storage-simulator.js | 混合存储模拟 |
| mock-extraction-data.js | 模拟提取数据 |

**说明**: 用于模拟特定场景的脚本

---

## 🔧 06-utilities/ - 工具脚本

| 文件 | 用途 |
|------|------|
| add-accounts.js | 批量添加账号 |
| search-biz-id.js | 搜索公众号BizId |
| 3day-test-tracker.js | 3天测试追踪器 |
| auto-downgrade.js | 自动降级工具 |
| fetch-5-articles.js | 抓取5篇文章测试 |
| analyze-storage-impact.js | 分析存储影响 |

**说明**: 辅助工具脚本

---

## ⚙️ 07-test-config/ - 测试配置

| 文件 | 用途 |
|------|------|
| jest-e2e.json | E2E测试配置 |
| jest-database.json | 数据库测试配置 |
| app.e2e-spec.ts | E2E测试规范 |
| database.spec.ts | 数据库测试规范 |

**说明**: Jest 测试框架配置

---

## 📂 data/ - 测试数据

| 子目录 | 文件 | 用途 |
|--------|------|------|
| 9day-pressure-test/ | Day1-9 测试报告 | 9天测试结果数据 |
| daily-reports/ | 每日报告 | 每日测试报告汇总 |
| pressure-test/ | 压力测试数据 | 压力测试结果 |

---

## 📋 快速索引

### 常用脚本
```bash
# Day 1-9 测试
node run-day1-test.js
node run-day9-test.js

# 生成报告
node daily-report.js
node database-full-report.js

# 检查状态
node check-feeds.js
node verify-database.js
```

### 分类文件数量统计
| 分类 | 文件数 |
|------|--------|
| Day测试脚本 | 9 |
| 压力测试脚本 | 4 |
| 检查验证脚本 | 12 |
| 报告分析脚本 | 4 |
| 模拟脚本 | 3 |
| 工具脚本 | 6 |
| 测试配置 | 4 |
| 数据文件 | ~10 |

**总计**: 约 52 个文件

---

*本文件用于文档化分类，不移动任何实际文件*
