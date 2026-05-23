# 方案B抓取上限测试 - 使用指南

## 📋 测试概述

**方案**: 保守策略（50-80篇/天）
**周期**: 3天快速验证
**目标**: 验证方案B全文存储的稳定性，找到安全抓取上限

---

## 📁 脚本说明

| 脚本 | 用途 | 使用频率 |
|------|------|---------|
| `pressure-test-scheme-b.js` | 执行压力测试 | 每个阶段执行1次 |
| `daily-report.js` | 生成每日抓取报告 | 每日定时 |
| `content-quality-analyzer.js` | 内容质量分析 | 按需 |

---

## 🚀 快速开始

### 阶段1：基线测试（第1天）

```bash
cd apps/server
node test/pressure-test-scheme-b.js --phase=1
```

**预期结果**: 30篇文章/天，成功率≥98%

---

### 阶段2：小幅加压（第2天）

```bash
node test/pressure-test-scheme-b.js --phase=2
```

**预期结果**: 60篇文章/天，成功率≥95%

---

### 阶段3：确定上限（第3天）

```bash
node test/pressure-test-scheme-b.js --phase=3
```

**预期结果**: 80篇文章/天，成功率≥90%

---

## 📊 配置参数

| 阶段 | 公众号/批次 | 文章/公众号 | 延迟 | 批次间隔 | 每日上限 |
|------|------------|------------|------|---------|---------|
| P1 基线 | 3 | 5 | 30-60秒 | 5分钟 | 30篇 |
| P2 加压 | 5 | 8 | 20-45秒 | 4分钟 | 60篇 |
| P3 上限 | 8 | 10 | 15-30秒 | 3分钟 | 80篇 |

---

## 📝 每日报告

### 生成今日报告

```bash
node test/daily-report.js
```

### 生成指定日期报告

```bash
node test/daily-report.js --date=2026-05-23
```

### 监控模式（每小时自动更新）

```bash
node test/daily-report.js --watch
```

---

## 📂 报告目录结构

```
apps/server/test/data/daily-reports/
├── INDEX.md                    # 报告索引
├── 2026-05-23/
│   └── daily-report.md         # 每日报告
├── 2026-05-24/
│   └── daily-report.md
└── pressure-tests/
    ├── 2026-05-23-phase1-report.md
    ├── 2026-05-24-phase2-report.md
    └── 2026-05-25-phase3-report.md
```

---

## ⏰ 配置定时任务（Windows任务计划）

### 每日报告 - 每天早上9点

```powershell
# 创建任务
schtasks /create /tn "WeWeRSS Daily Report" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/daily-report.js" /sc daily /st 09:00
```

### 压力测试 - 每天下午2点

```powershell
schtasks /create /tn "WeWeRSS Pressure Test" /tr "cd D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server && node test/pressure-test-scheme-b.js --phase=1" /sc daily /st 14:00
```

---

## 📈 判定标准

| 状态 | 成功率 | 403/429 | 操作 |
|------|--------|---------|------|
| 🟢 正常 | ≥ 95% | 无 | 继续下一阶段 |
| 🟡 警告 | 85-95% | 偶发 | 保持配置观察 |
| 🟠 危险 | 60-85% | 频繁 | 降低负载 |
| 🔴 封号 | < 60% | 连续 | 立即停止 |

---

## 🎯 测试成功标准

1. **P1 基线**: 成功率 ≥ 98% → 进入P2
2. **P2 加压**: 成功率 ≥ 95% → 进入P3
3. **P3 上限**: 成功率 ≥ 90% → 确定最终配置

**最终推荐配置**: P3配置（公众号8个/批次，文章10篇/公众号，延迟15-30秒）

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

## 📊 查看报告

报告生成后，在以下位置查看：

1. **JSON格式**: `test/data/daily-reports/*-report.json`
2. **Markdown格式**: `test/data/daily-reports/*-report.md`
3. **索引文件**: `test/data/daily-reports/INDEX.md`

---

## 🧹 清理旧报告

```bash
# 删除7天前的报告
Get-ChildItem -Path test/data/daily-reports -Directory | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) } | Remove-Item -Recurse
```
