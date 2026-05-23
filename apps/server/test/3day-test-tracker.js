const fs = require('fs');
const path = require('path');

const TEST_CONFIG = {
  days: [
    { day: 1, phase: 1, name: '基线测试', targetArticles: 30, minDelay: 30, maxDelay: 60, description: '验证基础抓取能力' },
    { day: 2, phase: 2, name: '小幅加压', targetArticles: 60, minDelay: 20, maxDelay: 45, description: '验证中等负载稳定性' },
    { day: 3, phase: 3, name: '确定上限', targetArticles: 80, minDelay: 15, maxDelay: 30, description: '验证极限负载承受能力' }
  ]
};

const REPORT_DIR = path.join(__dirname, '..', 'test', 'data', 'daily-reports', '3day-rapid-test');

class RapidTestTracker {
  constructor() {
    this.testState = {
      currentDay: 1,
      startedAt: new Date().toISOString(),
      results: [],
      status: 'pending'
    };
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
  }

  loadState() {
    const stateFile = path.join(REPORT_DIR, 'test-state.json');
    if (fs.existsSync(stateFile)) {
      this.testState = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    }
    return this.testState;
  }

  saveState() {
    const stateFile = path.join(REPORT_DIR, 'test-state.json');
    fs.writeFileSync(stateFile, JSON.stringify(this.testState, null, 2));
  }

  recordDayResult(day, phase, result) {
    this.testState.results.push({
      day,
      phase,
      timestamp: new Date().toISOString(),
      ...result
    });
    this.saveState();
  }

  generateDailyReport(day, phase, result) {
    const config = TEST_CONFIG.days.find(d => d.day === day);
    const reportDate = new Date().toISOString().split('T')[0];

    const report = `# 📊 3天快速测试 - 第${day}天报告

**测试日期**: ${reportDate}
**测试阶段**: ${config.name} (Phase ${phase})
**测试目标**: ${config.description}

---

## 📋 测试配置

| 参数 | 值 |
|------|-----|
| 每日文章目标 | ${config.targetArticles} |
| 抓取间隔 | ${config.minDelay}-${config.maxDelay}秒 |
| 测试阶段 | Phase ${phase} |

## 📈 测试结果

| 指标 | 数值 | 状态 |
|------|------|------|
| 总请求数 | ${result.totalRequests} | ${this.getStatusEmoji(result.successRate)} |
| 成功 | ${result.successfulRequests} | ${result.successfulRequests === result.totalRequests ? '✅' : '⚠️'} |
| 失败 | ${result.failedRequests} | ${result.failedRequests === 0 ? '✅' : '❌'} |
| 成功率 | ${result.successRate.toFixed(2)}% | ${this.getStatusText(result.successRate)} |
| 平均响应时间 | ${result.avgResponseTime}ms | ${result.avgResponseTime < 1000 ? '✅' : '⚠️'} |
| 总耗时 | ${Math.round(result.totalTime / 60)}分钟 | - |

## 📊 内容质量分析

| 指标 | 数值 |
|------|------|
| 有内容文章 (>10KB) | ${result.contentStats?.largeContent || 0} 篇 |
| 少量内容文章 (1-10KB) | ${result.contentStats?.mediumContent || 0} 篇 |
| 无/少内容文章 (<1KB) | ${result.contentStats?.smallContent || 0} 篇 |
| 总抓取大小 | ${result.contentStats?.totalSizeMB || 0} MB |

## 🚨 错误详情

${result.errors && result.errors.length > 0 ? `
| 文章ID | 错误类型 | 错误信息 |
|--------|---------|---------|
${result.errors.map(e => `| ${e.articleId || '-'} | ${e.errorType || '-'} | ${e.error || '-'} |`).join('\n')}
` : '无错误记录 ✅'}

## 📝 阶段评估

**当前状态**: ${this.getStatusText(result.successRate)}

${this.getRecommendation(result.successRate, day)}

---

## 📅 测试进度

| 天数 | 阶段 | 状态 | 成功率 |
|------|------|------|--------|
${this.generateProgressTable()}

---

*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`;

    const reportFile = path.join(REPORT_DIR, `day${day}-report.md`);
    fs.writeFileSync(reportFile, report);
    console.log(`\n📄 每日报告已保存: ${reportFile}`);

    return reportFile;
  }

  getStatusEmoji(rate) {
    if (rate >= 95) return '🟢';
    if (rate >= 85) return '🟡';
    if (rate >= 60) return '🟠';
    return '🔴';
  }

  getStatusText(rate) {
    if (rate >= 95) return '🟢 正常 - 可继续加压';
    if (rate >= 85) return '🟡 警告 - 保持观察';
    if (rate >= 60) return '🟠 危险 - 降低负载';
    return '🔴 封号风险 - 立即停止';
  }

  getRecommendation(successRate, currentDay) {
    if (successRate >= 95 && currentDay < 3) {
      return `**建议**: ✅ 成功率达标，可以进入第${currentDay + 1}天测试`;
    } else if (successRate >= 85 && currentDay < 3) {
      return `**建议**: ⚠️ 成功率可接受，但建议谨慎加压`;
    } else if (successRate < 85) {
      return `**建议**: ❌ 成功率偏低，建议暂停测试或降低配置`;
    } else if (currentDay === 3) {
      return `**最终结论**: 🎉 3天测试完成！推荐配置为Phase 3（80篇/天）`;
    }
    return '';
  }

  generateProgressTable() {
    let table = '';
    for (let i = 1; i <= 3; i++) {
      const result = this.testState.results.find(r => r.day === i);
      if (result) {
        table += `| 第${i}天 | Phase ${result.phase} | ✅ 已完成 | ${result.successRate.toFixed(2)}% |\n`;
      } else if (i === this.testState.currentDay) {
        table += `| 第${i}天 | - | 🔄 进行中 | - |\n`;
      } else {
        table += `| 第${i}天 | - | ⏳ 待开始 | - |\n`;
      }
    }
    return table;
  }

  generateSummaryReport() {
    const reportDate = new Date().toISOString().split('T')[0];

    const summary = `# 📊 3天快速测试 - 总结报告

**测试周期**: ${this.testState.startedAt.split('T')[0]} 至 ${reportDate}
**测试状态**: ✅ 完成

---

## 📈 总体结果

| 天数 | 阶段 | 目标 | 实际 | 成功率 | 状态 |
|------|------|------|------|--------|------|
${this.testState.results.map(r => {
  const config = TEST_CONFIG.days.find(d => d.day === r.day);
  return `| 第${r.day}天 | ${config.name} | ${config.targetArticles} | ${r.totalRequests} | ${r.successRate.toFixed(2)}% | ${this.getStatusEmoji(r.successRate)} ${this.getStatusText(r.successRate)} |`;
}).join('\n')}

## 📊 平均指标

| 指标 | 数值 |
|------|------|
| 平均成功率 | ${(this.testState.results.reduce((a, b) => a + b.successRate, 0) / this.testState.results.length).toFixed(2)}% |
| 平均响应时间 | ${Math.round(this.testState.results.reduce((a, b) => a + b.avgResponseTime, 0) / this.testState.results.length)}ms |
| 总抓取文章 | ${this.testState.results.reduce((a, b) => a + b.totalRequests, 0)} |
| 总耗时 | ${Math.round(this.testState.results.reduce((a, b) => a + b.totalTime, 0) / 60)}分钟 |

## 🎯 最终结论

${this.generateFinalConclusion()}

## 📁 详细报告

${this.testState.results.map(r => `- [第${r.day}天报告](./day${r.day}-report.md)`).join('\n')}

---

*总结报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`;

    const summaryFile = path.join(REPORT_DIR, 'SUMMARY.md');
    fs.writeFileSync(summaryFile, summary);
    console.log(`\n📄 总结报告已保存: ${summaryFile}`);

    return summaryFile;
  }

  generateFinalConclusion() {
    const avgSuccessRate = this.testState.results.reduce((a, b) => a + b.successRate, 0) / this.testState.results.length;
    const minSuccessRate = Math.min(...this.testState.results.map(r => r.successRate));

    if (minSuccessRate >= 95) {
      return `## ✅ 测试通过

**推荐配置**: Phase 3（每日80篇文章，间隔15-30秒）

**验证结果**:
- 🟢 3天测试全部成功
- 🟢 平均成功率 ${avgSuccessRate.toFixed(2)}%
- 🟢 防封号策略有效
- 🟢 可进入生产环境部署

**下一步**:
1. 将测试配置应用到生产环境
2. 配置定时任务自动执行
3. 持续监控抓取成功率
`;
    } else if (minSuccessRate >= 85) {
      return `## ⚠️ 测试通过但需谨慎

**推荐配置**: Phase 2（每日60篇文章，间隔20-45秒）

**验证结果**:
- 🟡 测试完成但有警告
- 🟡 最低成功率 ${minSuccessRate.toFixed(2)}%
- 🟡 建议降低负载配置

**下一步**:
1. 采用Phase 2配置
2. 加强监控频率
3. 准备降级预案
`;
    } else {
      return `## ❌ 测试未通过

**推荐配置**: Phase 1（每日30篇文章，间隔30-60秒）

**验证结果**:
- 🔴 成功率低于预期
- 🔴 最低成功率 ${minSuccessRate.toFixed(2)}%
- 🔴 需要降低负载

**下一步**:
1. 返回Phase 1配置
2. 检查错误原因
3. 修复后重新测试
`;
    }
  }

  updateCurrentDay(day) {
    this.testState.currentDay = day;
    this.saveState();
  }
}

if (require.main === module) {
  const tracker = new RapidTestTracker();
  const args = process.argv.slice(2);

  if (args.includes('--status')) {
    tracker.loadState();
    console.log('\n📊 3天快速测试状态:');
    console.log(JSON.stringify(tracker.testState, null, 2));
  } else if (args.includes('--summary')) {
    tracker.loadState();
    tracker.generateSummaryReport();
  } else if (args.includes('--report')) {
    const dayArg = args.find(a => a.startsWith('--day='));
    const day = dayArg ? parseInt(dayArg.split('=')[1]) : 1;
    console.log(`生成第${day}天报告...`);
  } else {
    console.log(`
📊 3天快速测试追踪器

用法:
  node 3day-test-tracker.js --status    查看当前测试状态
  node 3day-test-tracker.js --summary  生成总结报告
  node 3day-test-tracker.js --report    生成每日报告
    `);
  }
}

module.exports = RapidTestTracker;