# 方案B全文存储测试 - 9天综合指南

## 📋 测试概述

**方案**: 保守策略（50-80篇/天）
**周期**: 9天全面验证
**目标**: 验证方案B全文存储的稳定性，找到安全抓取上限

### 测试维度

| 维度 | 目标 | 测试天数 | 脚本命令 |
|------|------|----------|----------|
| 📊 公众号抓取上限 | 单批次最大公众号数量 | Day 1-3 | `--test=account-limit` |
| ⏱️ 抓取间隔测试 | 最小安全间隔时间 | Day 4-6 | `--test=interval` |
| 🔥 综合压力测试 | 连续运行稳定性 | Day 7-9 | `--test=combined` |

---

## 📁 脚本说明

| 脚本 | 用途 | 使用频率 |
|------|------|---------|
| `comprehensive-pressure-test.js` | 9天综合压力测试（推荐） | 每个测试维度执行1次 |
| `pressure-test-scheme-b.js` | 保守版压力测试 | 每个阶段执行1次 |
| `daily-report.js` | 生成每日抓取报告 | 每日定时 |
| `content-quality-analyzer.js` | 内容质量分析 | 按需 |

---

## 🚀 9天测试计划

### 第一阶段：Day 1-3 公众号抓取上限测试

**目标**: 测试单批次最大能安全抓取的公众号数量

| 天数 | 阶段 | 公众号数 | 文章/公众号 | 延迟 | 每日上限 |
|------|------|----------|-------------|------|----------|
| Day 1 | 小批量测试 | 3 | 5 | 30-60秒 | 30篇 |
| Day 1 | 增量测试 | 5 | 5 | 30-60秒 | 40篇 |
| Day 2 | 中批量测试 | 5 | 8 | 25-50秒 | 50篇 |
| Day 2 | 增量测试 | 7 | 8 | 25-50秒 | 60篇 |
| Day 3 | 大批量测试 | 8 | 10 | 20-45秒 | 80篇 |
| Day 3 | 极限测试 | 10 | 10 | 15-30秒 | 100篇 |

**测试命令**:
```bash
# 运行全部Day 1-3测试
node test/comprehensive-pressure-test.js --test=account-limit

# 仅运行Day 1测试
node test/comprehensive-pressure-test.js --test=account-limit --day=1
```

---

### 第二阶段：Day 4-6 抓取间隔测试

**目标**: 测试不同间隔时间下的成功率

| 天数 | 阶段 | 间隔 | 说明 |
|------|------|------|------|
| Day 4 | 长间隔测试 | 45-90秒 | 最安全但效率低 |
| Day 4 | 标准测试 | 30-60秒 | 平衡安全与效率 |
| Day 5 | 短间隔测试 | 20-40秒 | 较高效率 |
| Day 5 | 稳定性测试 | 25-50秒 | 平衡配置 |
| Day 6 | 极限间隔测试 | 10-20秒 | 最高效率，有风险 |
| Day 6 | 混合测试 | 15-35秒 | 综合验证 |

**测试命令**:
```bash
# 运行全部Day 4-6测试
node test/comprehensive-pressure-test.js --test=interval

# 仅运行Day 4测试
node test/comprehensive-pressure-test.js --test=interval --day=4
```

---

### 第三阶段：Day 7-9 综合压力测试

**目标**: 模拟实际生产环境连续运行

| 天数 | 阶段 | 持续时间 | 批次大小 | 延迟 |
|------|------|----------|----------|------|
| Day 7 | 连续1小时 | 60分钟 | 5个/批 | 30-60秒 |
| Day 7 | 连续2小时 | 120分钟 | 5个/批 | 30-60秒 |
| Day 8 | 连续2小时 | 120分钟 | 8个/批 | 20-45秒 |
| Day 8 | 连续3小时 | 180分钟 | 8个/批 | 20-45秒 |
| Day 9 | 连续4小时 | 240分钟 | 10个/批 | 15-30秒 |
| Day 9 | 长时稳定性 | 240分钟 | 10个/批 | 15-30秒 |

**测试命令**:
```bash
# 运行全部Day 7-9测试
node test/comprehensive-pressure-test.js --test=combined

# 仅运行Day 7测试
node test/comprehensive-pressure-test.js --test=combined --day=7
```

---

## 📊 判定标准

| 状态 | 成功率 | 403/429 | 操作 |
|------|--------|---------|------|
| 🟢 正常 | ≥ 95% | 无 | 继续下一阶段 |
| 🟡 警告 | 85-95% | 偶发 | 保持配置观察 |
| 🟠 危险 | 60-85% | 频繁 | 降低负载 |
| 🔴 封号 | < 60% | 连续 | 立即停止 |

---

## 🎯 测试成功标准

### 公众号抓取上限测试 (Day 1-3)
1. **Day 1 (3-5个)**: 成功率 ≥ 98% → 进入Day 2
2. **Day 2 (5-7个)**: 成功率 ≥ 95% → 进入Day 3
3. **Day 3 (8-10个)**: 成功率 ≥ 90% → 确定上限

**推荐**: 单批次 **5-8个公众号**

### 抓取间隔测试 (Day 4-6)
1. **Day 4 (45-90秒)**: 成功率 ≥ 98% → 可缩短间隔
2. **Day 5 (20-50秒)**: 成功率 ≥ 93% → 可尝试极限
3. **Day 6 (10-35秒)**: 成功率决定最终配置

**推荐**: 间隔 **25-45秒**

### 综合压力测试 (Day 7-9)
1. **Day 7 (1-2小时)**: 无异常 → 进入Day 8
2. **Day 8 (2-3小时)**: 成功率 ≥ 92% → 进入Day 9
3. **Day 9 (4小时+)**: 成功率 ≥ 90% → 确定最终配置

**推荐**: 连续运行 **2-4小时** 稳定性验证通过

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
apps/server/test/data/comprehensive-test/9day/
├── 2026-05-24-account-limit-day1-report.md    # Day 1报告
├── 2026-05-24-account-limit-day1-report.json
├── 2026-05-25-account-limit-day2-report.md    # Day 2报告
├── 2026-05-25-account-limit-day2-report.json
├── 2026-05-26-account-limit-day3-report.md    # Day 3报告
├── 2026-05-26-account-limit-day3-report.json
├── 2026-05-27-interval-day4-report.md         # Day 4报告
├── 2026-05-27-interval-day4-report.json
├── ... (依此类推)
```

---

## 🔧 最终配置推荐

根据测试结果，推荐以下配置：

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 单批次公众号数 | **5-8个** | 不超过8个 |
| 抓取间隔 | **25-45秒** | 随机波动 |
| 每日抓取上限 | **50-80篇** | 预留缓冲 |
| 批次间隔 | **5-10分钟** | 批次间休息 |
| 连续运行时间 | **2-4小时** | 需要休息 |

---

## ⏰ 配置定时任务（Windows任务计划）

### Day 1 - 公众号上限测试（明天14:00）
```powershell
schtasks /create /tn "WeWeRSS Day1 Account Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/comprehensive-pressure-test.js --test=account-limit --day=1" /sc once /st 14:00 /sd 2026/05/24
```

### Day 2 - 公众号增量测试（后天14:00）
```powershell
schtasks /create /tn "WeWeRSS Day2 Account Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/comprehensive-pressure-test.js --test=account-limit --day=2" /sc once /st 14:00 /sd 2026/05/25
```

### Day 3 - 公众号大批量测试（大后天14:00）
```powershell
schtasks /create /tn "WeWeRSS Day3 Account Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/comprehensive-pressure-test.js --test=account-limit --day=3" /sc once /st 14:00 /sd 2026/05/26
```

### Day 4 - 间隔测试（Day 4 14:00）
```powershell
schtasks /create /tn "WeWeRSS Day4 Interval Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/comprehensive-pressure-test.js --test=interval --day=4" /sc once /st 14:00 /sd 2026/05/27
```

### Day 5 - 间隔测试（Day 5 14:00）
```powershell
schtasks /create /tn "WeWeRSS Day5 Interval Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/comprehensive-pressure-test.js --test=interval --day=5" /sc once /st 14:00 /sd 2026/05/28
```

### Day 6 - 间隔极限测试（Day 6 14:00）
```powershell
schtasks /create /tn "WeWeRSS Day6 Interval Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/comprehensive-pressure-test.js --test=interval --day=6" /sc once /st 14:00 /sd 2026/05/29
```

### Day 7-9 - 综合测试（依次类推）
```powershell
schtasks /create /tn "WeWeRSS Day7 Combined Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/comprehensive-pressure-test.js --test=combined --day=7" /sc once /st 14:00 /sd 2026/05/30
```

---

## 🧹 清理旧报告

```bash
# 删除14天前的报告
Get-ChildItem -Path apps/server/test/data/comprehensive-test/9day -Filter "*.json" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item
```

---

## 📈 9天测试甘特图

```
Day 1  │█████████████│ 公众号上限测试 (3-5个)
Day 2  │█████████████│ 公众号上限测试 (5-7个)
Day 3  │█████████████│ 公众号上限测试 (8-10个)
Day 4  │█████████████│ 抓取间隔测试 (45-90秒)
Day 5  │█████████████│ 抓取间隔测试 (20-50秒)
Day 6  │█████████████│ 抓取间隔测试 (10-35秒)
Day 7  │█████████████│ 综合压力测试 (1-2小时)
Day 8  │█████████████│ 综合压力测试 (2-3小时)
Day 9  │█████████████│ 综合压力测试 (4小时+)
```

---

*最后更新: 2026-05-23*