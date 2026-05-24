# 方案B全文存储测试 - 9天渐进式指南

## 📋 测试概述

**方案**: 保守策略（50-80篇/天）
**周期**: 9天渐进式验证
**目标**: 从基础到复杂，逐步确定安全抓取参数

### 测试逻辑（从基础到复杂）

```
Step 1: 先确定"每天能抓多少篇文章"
         ↓
Step 2: 在最大文章数基础上，确定"能抓多少个公众号"
         ↓
Step 3: 在最大文章+公众号基础上，确定"间隔多久最安全"
```

---

## 📁 脚本说明

| 脚本 | 用途 |
|------|------|
| `pressure-test-9day.js` | 9天渐进式压力测试（推荐） |
| `comprehensive-pressure-test.js` | 综合压力测试（旧版） |
| `daily-report.js` | 生成每日抓取报告 |
| `content-quality-analyzer.js` | 内容质量分析 |

---

## 🚀 9天测试计划

### 第一阶段：Day 1-3 文章数量测试
**目标**: 确定单日最大文章抓取量（固定3个公众号，逐步增加文章数）

| 天数 | 阶段 | 公众号数 | 文章/公众号 | 日总量 | 延迟 |
|------|------|----------|-------------|--------|------|
| Day 1 | 基线测试 | 3 | 5 | 15篇 | 30-60秒 |
| Day 2 | 增量测试 | 3 | 10 | 30篇 | 30-60秒 |
| Day 3 | 极限测试 | 3 | 15 | 45篇 | 30-60秒 |

**成功标准**: 成功率 ≥ 95%

**测试命令**:
```bash
# 运行全部 Day 1-3 测试
node test/pressure-test-9day.js --test=article-count

# 仅运行 Day 1 测试
node test/pressure-test-9day.js --test=article-count --day=1
```

---

### 第二阶段：Day 4-6 公众号数量测试
**目标**: 确定在最大文章数基础上，能抓多少个公众号

| 天数 | 阶段 | 公众号数 | 文章/公众号 | 日总量 | 延迟 |
|------|------|----------|-------------|--------|------|
| Day 4 | 小批量 | 5 | 10 | 50篇 | 30-60秒 |
| Day 5 | 中批量 | 8 | 10 | 80篇 | 25-50秒 |
| Day 6 | 大批量 | 10 | 10 | 100篇 | 20-45秒 |

**成功标准**: 成功率 ≥ 92%

**测试命令**:
```bash
# 运行全部 Day 4-6 测试
node test/pressure-test-9day.js --test=account-count

# 仅运行 Day 4 测试
node test/pressure-test-9day.js --test=account-count --day=4
```

---

### 第三阶段：Day 7-9 间隔时间测试
**目标**: 在最大文章+公众号基础上，确定最安全间隔

| 天数 | 阶段 | 公众号数 | 文章/公众号 | 间隔 | 预计日总量 |
|------|------|----------|-------------|------|------------|
| Day 7 | 长间隔 | 8 | 10 | 45-90秒 | 40篇 |
| Day 8 | 标准间隔 | 8 | 10 | 30-60秒 | 60篇 |
| Day 9 | 短间隔 | 8 | 10 | 20-40秒 | 80篇 |

**成功标准**: 成功率 ≥ 90%

**测试命令**:
```bash
# 运行全部 Day 7-9 测试
node test/pressure-test-9day.js --test=interval

# 仅运行 Day 7 测试
node test/pressure-test-9day.js --test=interval --day=7
```

---

## 🎯 运行全部9天测试

```bash
# 一键运行全部9天测试
node test/pressure-test-9day.js --run-all
```

**注意**: 完整运行需要约 9 天时间，建议分阶段执行

---

## 📈 测试依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│  Day 1-3: 文章数量测试                                       │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│  │ Day 1   │ →  │ Day 2   │ →  │ Day 3   │               │
│  │ 15篇/天 │    │ 30篇/天 │    │ 45篇/天 │               │
│  └─────────┘    └────↑────┘    └─────────┘               │
│                        │                                  │
│                  确定最大日文章数                            │
└────────────────────────┼───────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Day 4-6: 公众号数量测试                                    │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│  │ Day 4   │ →  │ Day 5   │ →  │ Day 6   │               │
│  │ 5个号   │    │ 8个号   │    │ 10个号  │               │
│  └─────────┘    └────↑────┘    └─────────┘               │
│                        │                                  │
│                  确定最大公众号数                            │
└────────────────────────┼───────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Day 7-9: 间隔时间测试                                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│  │ Day 7   │ →  │ Day 8   │ →  │ Day 9   │               │
│  │45-90秒  │    │30-60秒  │    │20-40秒  │               │
│  └─────────┘    └────↑────┘    └─────────┘               │
│                        │                                  │
│                  确定最终安全配置                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 判定标准

| 状态 | 成功率 | 403/429 | 操作 |
|------|--------|---------|------|
| 🟢 通过 | ≥ 阈值 | 无 | 进入下一阶段 |
| 🟡 警告 | 阈值-10% | 偶发 | 保持观察 |
| 🔴 危险 | < 阈值-10% | 频繁 | 降低配置 |

### 各阶段阈值

| 测试类型 | 阈值 | 天数 |
|----------|------|------|
| 文章数量 | ≥ 95% | Day 1-3 |
| 公众号数量 | ≥ 92% | Day 4-6 |
| 间隔时间 | ≥ 90% | Day 7-9 |

---

## 🎯 最终目标配置（待测试确认）

| 参数 | 推荐值 | 测试来源 |
|------|--------|----------|
| 单日最大文章数 | 30-45篇 | Day 1-3 |
| 单批次最大公众号数 | 8-10个 | Day 4-6 |
| 安全间隔时间 | 30-45秒 | Day 7-9 |
| 每日安全抓取量 | 50-80篇 | 综合结果 |

---

## ⚠️ 风险处理

### 出现403错误
```
1. 立即停止测试
2. 等待30分钟后重试
3. 如果仍然失败，降低延迟参数
4. 记录封号时间和配置
```

### 出现429错误
```
1. 降低抓取频率
2. 增加批次间隔
3. 记录限流时间点
```

### 连续失败超过10次
```
1. 自动暂停测试
2. 等待1小时后再试
3. 记录失败日志
4. 报告给管理员
```

---

## 📂 报告目录结构

```
apps/server/test/data/9day-pressure-test/
├── 2026-05-24-article-count-day1-report.md
├── 2026-05-24-article-count-day1-report.json
├── ...
├── 2026-05-27-account-count-day4-report.md
├── ...
├── 2026-05-30-interval-day7-report.md
├── ...
└── 2026-05-30-FINAL-report.md    # 最终汇总报告
```

---

## ⏰ 配置定时任务（Windows任务计划）

### Day 1 - 文章数量基线（明天14:00）
```powershell
schtasks /create /tn "WeWeRSS Day1 Article Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/pressure-test-9day.js --test=article-count --day=1" /sc once /st 14:00 /sd 2026/05/24
```

### Day 2 - 文章数量增量
```powershell
schtasks /create /tn "WeWeRSS Day2 Article Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/pressure-test-9day.js --test=article-count --day=2" /sc once /st 14:00 /sd 2026/05/25
```

### Day 3 - 文章数量极限
```powershell
schtasks /create /tn "WeWeRSS Day3 Article Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/pressure-test-9day.js --test=article-count --day=3" /sc once /st 14:00 /sd 2026/05/26
```

### Day 4-6 - 公众号数量测试
```powershell
schtasks /create /tn "WeWeRSS Day4 Account Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/pressure-test-9day.js --test=account-count --day=4" /sc once /st 14:00 /sd 2026/05/27

schtasks /create /tn "WeWeRSS Day5 Account Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/pressure-test-9day.js --test=account-count --day=5" /sc once /st 14:00 /sd 2026/05/28

schtasks /create /tn "WeWeRSS Day6 Account Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/pressure-test-9day.js --test=account-count --day=6" /sc once /st 14:00 /sd 2026/05/29
```

### Day 7-9 - 间隔时间测试
```powershell
schtasks /create /tn "WeWeRSS Day7 Interval Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/pressure-test-9day.js --test=interval --day=7" /sc once /st 14:00 /sd 2026/05/30

schtasks /create /tn "WeWeRSS Day8 Interval Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/pressure-test-9day.js --test=interval --day=8" /sc once /st 14:00 /sd 2026/05/31

schtasks /create /tn "WeWeRSS Day9 Interval Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/pressure-test-9day.js --test=interval --day=9" /sc once /st 14:00 /sd 2026/06/01
```

---

## 🧹 清理旧报告

```bash
# 删除14天前的报告
Get-ChildItem -Path apps/server/test/data/9day-pressure-test -Filter "*.json" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item
```

---

## 📈 9天测试甘特图

```
Day 1  │█████████████│ 文章数量: 3公众号 × 5篇 = 15篇/天
Day 2  │█████████████│ 文章数量: 3公众号 × 10篇 = 30篇/天
Day 3  │█████████████│ 文章数量: 3公众号 × 15篇 = 45篇/天
        ↓ 确定最大日文章数
─────────────────────────────────────────────────────────────
Day 4  │█████████████│ 公众号数量: 5公众号 × 10篇 = 50篇/天
Day 5  │█████████████│ 公众号数量: 8公众号 × 10篇 = 80篇/天
Day 6  │█████████████│ 公众号数量: 10公众号 × 10篇 = 100篇/天
        ↓ 确定最大公众号数
─────────────────────────────────────────────────────────────
Day 7  │█████████████│ 间隔测试: 8公众号 × 10篇, 间隔45-90秒
Day 8  │█████████████│ 间隔测试: 8公众号 × 10篇, 间隔30-60秒
Day 9  │█████████████│ 间隔测试: 8公众号 × 10篇, 间隔20-40秒
        ↓ 确定最终安全配置
```

---

*最后更新: 2026-05-23*