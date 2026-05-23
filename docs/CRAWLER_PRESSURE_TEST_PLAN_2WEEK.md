# 爬虫抓取上限压力测试方案（2周压缩版）

> **版本**: v1.0
> **日期**: 2026-05-17
> **预计周期**: 14天（2周）

---

## 一、测试目标

```
┌─────────────────────────────────────────────────────────┐
│                    测试目标                               │
├─────────────────────────────────────────────────────────┤
│  1. 找出「不触发封号/限制」的最大抓取量                   │
│  2. 找出「触发封号/限制」的临界点                       │
│  3. 确定「安全上限」与「推荐配置」                      │
└─────────────────────────────────────────────────────────┘
```

---

## 二、压缩后的测试周期（14天）

### 📅 第1周：渐进加压阶段（Day 1-7）

| 日期 | 阶段 | 公众号/批次 | 文章/公众号 | 延迟(秒) | 每日预算 | 目标 |
|------|------|------------|------------|---------|---------|------|
| Day 1-2 | **基线测试** | 3 | 5 | 30-120 | 50次 | 稳定运行，确认基线 |
| Day 3-4 | **小幅加压** | 5 | 8 | 20-90 | 80次 | 观察响应变化 |
| Day 5-6 | **接近上限** | 8 | 10 | 15-60 | 100次 | 寻找临界点 |
| Day 7 | **极限试探** | 10 | 12 | 10-45 | 120次 | 触发边界，观察告警 |

### 📅 第2周：回归验证阶段（Day 8-14）

| 日期 | 阶段 | 公众号/批次 | 文章/公众号 | 延迟(秒) | 每日预算 | 目标 |
|------|------|------------|------------|---------|---------|------|
| Day 8-9 | **安全配置验证** | 8 | 10 | 15-60 | 100次 | 验证安全配置 |
| Day 10-11 | **配置微调** | 8 | 12 | 15-45 | 110次 | 寻找最佳平衡 |
| Day 12-13 | **最终验证** | 10 | 10 | 15-45 | 120次 | 确认最终推荐配置 |
| Day 14 | **汇总报告** | - | - | - | - | 输出测试报告 |

---

## 三、判定标准

| 等级 | 条件 | 成功率 | 403/429频率 | 处理措施 |
|------|------|--------|------------|---------|
| 🟢 正常 | 继续当前配置 | ≥ 95% | 无或偶发 | 继续加压 |
| 🟡 警告 | 降低20%负载 | 85-95% | 偶尔 | 自动降级配置 |
| 🟠 危险 | 降低50%负载 | 60-85% | 频繁 | 立即告警+降级 |
| 🔴 封号 | 停止测试 | < 60% | 大量 | 立即停止+通知 |

---

## 四、测试配置参数

### 4.1 各阶段配置详情

```javascript
// 阶段1: 基线测试 (Day 1-2)
const PHASE_1 = {
  name: '基线测试',
  maxFeedsPerBatch: 3,
  maxArticlesPerFeed: 5,
  minDelaySeconds: 30,
  maxDelaySeconds: 120,
  batchIntervalSeconds: 300,
  dailyBudget: 50,
  expectedSuccessRate: 0.98,
};

// 阶段2: 小幅加压 (Day 3-4)
const PHASE_2 = {
  name: '小幅加压',
  maxFeedsPerBatch: 5,
  maxArticlesPerFeed: 8,
  minDelaySeconds: 20,
  maxDelaySeconds: 90,
  batchIntervalSeconds: 240,
  dailyBudget: 80,
  expectedSuccessRate: 0.95,
};

// 阶段3: 接近上限 (Day 5-6)
const PHASE_3 = {
  name: '接近上限',
  maxFeedsPerBatch: 8,
  maxArticlesPerFeed: 10,
  minDelaySeconds: 15,
  maxDelaySeconds: 60,
  batchIntervalSeconds: 180,
  dailyBudget: 100,
  expectedSuccessRate: 0.90,
};

// 阶段4: 极限试探 (Day 7)
const PHASE_4 = {
  name: '极限试探',
  maxFeedsPerBatch: 10,
  maxArticlesPerFeed: 12,
  minDelaySeconds: 10,
  maxDelaySeconds: 45,
  batchIntervalSeconds: 120,
  dailyBudget: 120,
  expectedSuccessRate: 0.85,
};

// 阶段5: 安全配置验证 (Day 8-9)
const PHASE_5 = {
  name: '安全配置验证',
  maxFeedsPerBatch: 8,
  maxArticlesPerFeed: 10,
  minDelaySeconds: 15,
  maxDelaySeconds: 60,
  batchIntervalSeconds: 180,
  dailyBudget: 100,
  expectedSuccessRate: 0.95,
};

// 阶段6: 配置微调 (Day 10-11)
const PHASE_6 = {
  name: '配置微调',
  maxFeedsPerBatch: 8,
  maxArticlesPerFeed: 12,
  minDelaySeconds: 15,
  maxDelaySeconds: 45,
  batchIntervalSeconds: 150,
  dailyBudget: 110,
  expectedSuccessRate: 0.93,
};

// 阶段7: 最终验证 (Day 12-13)
const PHASE_7 = {
  name: '最终验证',
  maxFeedsPerBatch: 10,
  maxArticlesPerFeed: 10,
  minDelaySeconds: 15,
  maxDelaySeconds: 45,
  batchIntervalSeconds: 120,
  dailyBudget: 120,
  expectedSuccessRate: 0.92,
};
```

---

## 五、测试脚本说明

| 脚本名称 | 功能 | 使用阶段 |
|---------|------|---------|
| `pressure-test.js` | 主测试脚本，执行抓取任务 | Day 1-13 |
| `monitor-report.js` | 监控报告生成 | 每日 |
| `auto-downgrade.js` | 自动降级配置 | 触发警告时 |
| `test-summary.js` | 生成测试汇总报告 | Day 14 |

---

## 六、执行方式

### 每日测试流程

```bash
# 1. 启动测试（每天早上9点）
node test/pressure-test.js --phase=1 --day=1

# 2. 查看实时监控
node test/monitor-report.js --realtime

# 3. 如触发告警，自动降级
node test/auto-downgrade.js --auto

# 4. 每日结束生成报告
node test/monitor-report.js --daily --date=2026-05-18
```

### 测试日志输出

```
╔══════════════════════════════════════════════════════════════════╗
║              爬虫压力测试 - Day 3 (Phase 2)                      ║
╠══════════════════════════════════════════════════════════════════╣
║  配置: 公众号5个/批 | 文章8篇/公众号 | 延迟20-90秒              ║
║  进度: ████████░░░░░░░░░░░░░░ 40% (32/80 次请求)              ║
║  成功率: 96.8% (31/32)                                         ║
║  状态: 🟢 正常                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 七、告警机制

### 自动告警条件

| 告警级别 | 触发条件 | 自动操作 | 通知方式 |
|---------|---------|---------|---------|
| 警告 | 成功率 < 95% | 自动降级到上一阶段配置 | 控制台 + 日志 |
| 危险 | 成功率 < 85% | 暂停测试，降级配置 | 控制台 + 日志 + 邮件 |
| 封号 | 403/429 连续3次 | 立即停止所有测试 | 控制台 + 日志 + 邮件 + 短信 |

### 自动降级规则

```
当成功率 < 95% 时:
  1. 记录当前状态
  2. 降低配置:
     - 公众号数: -20%
     - 延迟: +30%
     - 批次间隔: +50%
  3. 继续测试观察

当成功率 < 85% 或连续403时:
  1. 立即停止测试
  2. 记录完整日志
  3. 等待30分钟后重试
  4. 如果仍然失败，报告给管理员
```

---

## 八、测试数据收集

### 每日收集指标

```javascript
const metrics = {
  // 数量统计
  totalRequests: 0,           // 总请求数
  successRequests: 0,          // 成功请求数
  failedRequests: 0,          // 失败请求数

  // 成功率
  successRate: 0,              // 成功率 (successRequests / totalRequests)

  // 错误分布
  errorDistribution: {
    timeout: 0,               // 超时
    networkError: 0,          // 网络错误
    forbidden: 0,             // 403 封号
    rateLimit: 0,              // 429 限流
    serverError: 0,            // 500 服务器错误
  },

  // 性能指标
  avgResponseTime: 0,          // 平均响应时间 (ms)
  minResponseTime: 0,         // 最小响应时间
  maxResponseTime: 0,          // 最大响应时间

  // 时间消耗
  totalDuration: 0,            // 总耗时 (ms)
  avgDelay: 0,                 // 实际延迟 (ms)

  // 告警记录
  alerts: [],                  // 告警列表
};
```

---

## 九、测试报告模板

### 每日报告结构

```markdown
# 爬虫压力测试日报 - Day X

## 测试配置
- 测试阶段: Phase X
- 公众号数/批次: X
- 文章数/公众号: X
- 延迟范围: X-X 秒

## 测试结果
- 总请求数: X
- 成功: X (XX%)
- 失败: X (XX%)
- 平均响应时间: X ms

## 错误分析
| 错误类型 | 次数 | 占比 | 可能原因 |
|---------|------|------|---------|
| 403 Forbidden | X | XX% | 封号/IP限制 |
| 429 Rate Limit | X | XX% | 请求过于频繁 |
| Timeout | X | XX% | 网络问题 |

## 状态评估
- 当前状态: 🟢 正常 / 🟡 警告 / 🟠 危险 / 🔴 封号
- 建议操作: 继续加压 / 保持配置 / 降低负载 / 停止测试

## 与昨日对比
- 成功率变化: +X% / -X%
- 响应时间变化: +Xms / -Xms
- 配置变更: 无 / 已自动降级
```

---

## 十、最终输出

### Day 14 产出

```
📊 测试完成报告

【最终推荐配置】
- 公众号数/批次: X个 (安全上限: X个)
- 文章数/公众号: X篇 (安全上限: X篇)
- 最小延迟: X秒
- 最大延迟: X秒
- 批次间隔: X秒

【安全边界】
- 每日安全请求数: X次
- 危险临界点: X次/日
- 触发封号的配置: X

【风险提示】
- 可能触发限制的情况:
- 被封后的恢复建议:

【测试结论】
- 配置方案可用于生产环境: ✅ / ❌
- 需要进一步测试: 是 / 否
```
