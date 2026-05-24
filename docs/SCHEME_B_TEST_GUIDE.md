# 方案B全文存储测试 - 综合指南

## 📋 测试概述

**方案**: 保守策略（50-80篇/天）
**周期**: 3天快速验证
**目标**: 验证方案B全文存储的稳定性，找到安全抓取上限

### 测试维度

| 维度 | 目标 | 测试脚本 |
|------|------|---------|
| 📊 公众号抓取上限 | 单批次最大公众号数量 | `comprehensive-pressure-test.js --test=account-limit` |
| ⏱️ 抓取间隔测试 | 最小安全间隔时间 | `comprehensive-pressure-test.js --test=interval` |
| 🔥 综合压力测试 | 连续运行稳定性 | `comprehensive-pressure-test.js --test=combined` |

---

## 📁 脚本说明

| 脚本 | 用途 | 使用频率 |
|------|------|---------|
| `comprehensive-pressure-test.js` | 综合压力测试（推荐） | 每个测试维度执行1次 |
| `pressure-test-scheme-b.js` | 保守版压力测试 | 每个阶段执行1次 |
| `daily-report.js` | 生成每日抓取报告 | 每日定时 |
| `content-quality-analyzer.js` | 内容质量分析 | 按需 |

---

## 🚀 快速开始

### 第一步：测试公众号抓取上限

```bash
cd apps/server
node test/comprehensive-pressure-test.js --test=account-limit
```

**测试内容**: 从3个公众号逐步增加到10个公众号，找出单批次最大安全数量

| 阶段 | 公众号数 | 文章/公众号 | 延迟 | 每日上限 |
|------|----------|-------------|------|----------|
| 小批量 | 3 | 5 | 30-60秒 | 30篇 |
| 中批量 | 5 | 8 | 25-50秒 | 50篇 |
| 大批量 | 8 | 10 | 20-45秒 | 80篇 |
| 极限 | 10 | 10 | 15-30秒 | 100篇 |

---

### 第二步：测试抓取间隔

```bash
node test/comprehensive-pressure-test.js --test=interval
```

**测试内容**: 测试10秒到90秒不同间隔下的成功率

| 阶段 | 间隔 | 说明 |
|------|------|------|
| 长间隔 | 45-90秒 | 最安全但效率低 |
| 标准间隔 | 30-60秒 | 平衡安全与效率 |
| 短间隔 | 20-40秒 | 较高效率 |
| 极限间隔 | 10-20秒 | 最高效率，有风险 |

---

### 第三步：综合压力测试

```bash
node test/comprehensive-pressure-test.js --test=combined
```

**测试内容**: 模拟实际生产环境连续运行

| 阶段 | 持续时间 | 配置 |
|------|----------|------|
| 连续1小时 | 60分钟 | 标准配置 |
| 连续2小时 | 120分钟 | 标准配置 |
| 连续4小时 | 240分钟 | 高负载配置 |

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

### 公众号抓取上限测试
1. **小批量(3)**: 成功率 ≥ 98% → 进入中批量
2. **中批量(5)**: 成功率 ≥ 95% → 进入大批量
3. **大批量(8)**: 成功率 ≥ 92% → 进入极限
4. **极限(10)**: 成功率 ≥ 88% → 确定上限

**推荐**: 单批次 **5-8个公众号**

### 抓取间隔测试
1. **长间隔(45-90秒)**: 成功率 ≥ 98% → 可缩短间隔
2. **标准间隔(30-60秒)**: 成功率 ≥ 95% → 可尝试短间隔
3. **短间隔(20-40秒)**: 成功率 ≥ 90% → 可尝试极限
4. **极限间隔(10-20秒)**: 成功率决定最终配置

**推荐**: 间隔 **25-45秒**

### 综合压力测试
1. **连续1小时**: 无异常 → 进入2小时
2. **连续2小时**: 无异常 → 进入4小时
3. **连续4小时**: 成功率 ≥ 92% → 确定最终配置

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

## 📝 3天测试计划

### Day 1: 公众号数量测试
```
上午: node test/comprehensive-pressure-test.js --test=account-limit
下午: 分析结果，确定安全公众号数量
```

### Day 2: 抓取间隔测试
```
上午: node test/comprehensive-pressure-test.js --test=interval
下午: 分析结果，确定安全间隔时间
```

### Day 3: 综合验证测试
```
上午: node test/comprehensive-pressure-test.js --test=combined
下午: 生成最终测试报告
```

---

## 📂 报告目录结构

```
apps/server/test/data/comprehensive-test/
├── 2026-05-23-account-limit-report.md    # 公众号上限测试报告
├── 2026-05-23-account-limit-report.json
├── 2026-05-24-interval-report.md         # 间隔测试报告
├── 2026-05-24-interval-report.json
├── 2026-05-25-combined-report.md         # 综合测试报告
└── 2026-05-25-combined-report.json
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

## 📈 查看报告

```bash
# 查看最新报告
Get-Content apps/server/test/data/comprehensive-test/*.md | Select-Object -First 50

# 查看指定日期报告
Get-Content "apps/server/test/data/comprehensive-test/2026-05-23-account-limit-report.md"
```

---

## ⏰ 配置定时任务（Windows任务计划）

### Day 1 - 公众号上限测试（明天14:00）
```powershell
schtasks /create /tn "WeWeRSS Account Limit Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/comprehensive-pressure-test.js --test=account-limit" /sc once /st 14:00 /sd 2026/05/24
```

### Day 2 - 间隔测试（后天14:00）
```powershell
schtasks /create /tn "WeWeRSS Interval Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/comprehensive-pressure-test.js --test=interval" /sc once /st 14:00 /sd 2026/05/25
```

### Day 3 - 综合测试（大后天14:00）
```powershell
schtasks /create /tn "WeWeRSS Combined Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/comprehensive-pressure-test.js --test=combined" /sc once /st 14:00 /sd 2026/05/26
```

---

## 🧹 清理旧报告

```bash
# 删除7天前的报告
Get-ChildItem -Path apps/server/test/data/comprehensive-test -Filter "*.json" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item
```

---

*最后更新: 2026-05-23*