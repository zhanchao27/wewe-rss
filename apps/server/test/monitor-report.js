/**
 * 压力测试监控报告脚本
 *
 * 使用方式:
 *   node test/monitor-report.js --daily --date=2026-05-18
 *   node test/monitor-report.js --weekly
 *   node test/monitor-report.js --summary
 *
 * 功能:
 *   - 生成每日测试报告
 *   - 生成每周汇总报告
 *   - 生成最终测试总结
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data', 'pressure-test');
const REPORT_DIR = path.join(DATA_DIR, 'reports');

class MonitorReporter {
  constructor() {
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
  }

  getAllReports() {
    if (!fs.existsSync(DATA_DIR)) {
      return [];
    }

    return fs.readdirSync(DATA_DIR)
      .filter(f => f.startsWith('report-') && f.endsWith('.json'))
      .map(f => {
        const content = fs.readFileSync(path.join(DATA_DIR, f), 'utf8');
        return JSON.parse(content);
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  generateDailyReport(date) {
    const reports = this.getAllReports().filter(r => r.date === date);

    if (reports.length === 0) {
      console.log(`❌ 未找到 ${date} 的测试报告`);
      return null;
    }

    const report = reports[0];

    console.log('\n' + '═'.repeat(70));
    console.log(`📊 爬虫压力测试日报 - ${date}`);
    console.log('═'.repeat(70));

    console.log('\n📋 测试配置');
    console.log(`  阶段: Phase ${report.phase}`);
    console.log(`  公众号数/批次: ${report.config.maxFeedsPerBatch}`);
    console.log(`  文章数/公众号: ${report.config.maxArticlesPerFeed}`);
    console.log(`  延迟范围: ${report.config.minDelaySeconds}-${report.config.maxDelaySeconds}秒`);
    console.log(`  批次间隔: ${report.config.batchIntervalSeconds}秒`);

    console.log('\n📈 测试结果');
    console.log(`  总请求数: ${report.metrics.totalRequests}`);
    console.log(`  成功请求: ${report.metrics.successRequests} (${(report.metrics.successRate * 100).toFixed(1)}%)`);
    console.log(`  失败请求: ${report.metrics.failedRequests}`);
    console.log(`  平均响应时间: ${report.metrics.avgResponseTime}ms`);
    console.log(`  最小响应时间: ${report.metrics.minResponseTime}ms`);
    console.log(`  最大响应时间: ${report.metrics.maxResponseTime}ms`);

    console.log('\n❌ 错误分布');
    const errors = report.metrics.errorDistribution;
    const errorTotal = Object.values(errors).reduce((a, b) => a + b, 0);

    if (errorTotal === 0) {
      console.log('  无错误');
    } else {
      for (const [type, count] of Object.entries(errors)) {
        if (count > 0) {
          const percentage = ((count / errorTotal) * 100).toFixed(1);
          console.log(`  ${type}: ${count} (${percentage}%)`);
        }
      }
    }

    console.log('\n📝 告警记录');
    if (report.metrics.alerts && report.metrics.alerts.length > 0) {
      report.metrics.alerts.forEach(alert => {
        console.log(`  [${alert.level.toUpperCase()}] ${alert.message}`);
      });
    } else {
      console.log('  无告警');
    }

    console.log('\n🎯 状态评估');
    let statusText = '';
    let statusEmoji = '';
    if (report.metrics.successRate >= 0.95) {
      statusText = '正常 - 可继续当前配置或适当加压';
      statusEmoji = '🟢';
    } else if (report.metrics.successRate >= 0.85) {
      statusText = '警告 - 建议保持配置观察';
      statusEmoji = '🟡';
    } else if (report.metrics.successRate >= 0.60) {
      statusText = '危险 - 建议降低20%负载';
      statusEmoji = '🟠';
    } else {
      statusText = '封号风险 - 立即停止测试，检查原因';
      statusEmoji = '🔴';
    }
    console.log(`  ${statusEmoji} ${statusText}`);

    const markdownContent = this.generateMarkdownReport(report);
    const filename = path.join(REPORT_DIR, `daily-report-${date}.md`);
    fs.writeFileSync(filename, markdownContent);
    console.log(`\n📄 Markdown报告已保存: ${filename}`);

    console.log('\n' + '═'.repeat(70));

    return report;
  }

  generateWeeklyReport(weekNumber) {
    const reports = this.getAllReports();
    const weekReports = reports.slice(-7);

    if (weekReports.length === 0) {
      console.log('❌ 未找到本周的测试报告');
      return null;
    }

    console.log('\n' + '═'.repeat(70));
    console.log(`📊 爬虫压力测试周报 - 第${weekNumber}周`);
    console.log('═'.repeat(70));

    console.log('\n📅 测试概览');
    console.log(`  测试天数: ${weekReports.length}`);
    console.log(`  测试阶段: Phase ${weekReports[0].phase} → Phase ${weekReports[weekReports.length - 1].phase}`);

    const totalRequests = weekReports.reduce((sum, r) => sum + r.metrics.totalRequests, 0);
    const totalSuccess = weekReports.reduce((sum, r) => sum + r.metrics.successRequests, 0);
    const avgSuccessRate = totalSuccess / totalRequests;
    const avgResponseTime = weekReports.reduce((sum, r) => sum + r.metrics.avgResponseTime, 0) / weekReports.length;

    console.log('\n📈 本周汇总');
    console.log(`  总请求数: ${totalRequests}`);
    console.log(`  总成功数: ${totalSuccess} (${(avgSuccessRate * 100).toFixed(1)}%)`);
    console.log(`  平均响应时间: ${Math.round(avgResponseTime)}ms`);

    console.log('\n📊 每日详情');
    weekReports.forEach(report => {
      const emoji = report.metrics.successRate >= 0.95 ? '🟢' :
                     report.metrics.successRate >= 0.85 ? '🟡' :
                     report.metrics.successRate >= 0.60 ? '🟠' : '🔴';
      console.log(`  ${report.date} | 成功率: ${(report.metrics.successRate * 100).toFixed(1)}% | 响应: ${report.metrics.avgResponseTime}ms | ${emoji} ${report.status}`);
    });

    const allAlerts = weekReports.flatMap(r => r.metrics.alerts || []);
    const criticalAlerts = allAlerts.filter(a => a.level === 'critical');
    const dangerAlerts = allAlerts.filter(a => a.level === 'danger');
    const warningAlerts = allAlerts.filter(a => a.level === 'warning');

    console.log('\n📝 告警统计');
    console.log(`  严重告警 (Critical): ${criticalAlerts.length}`);
    console.log(`  危险告警 (Danger): ${dangerAlerts.length}`);
    console.log(`  警告告警 (Warning): ${warningAlerts.length}`);

    console.log('\n🎯 周评估');
    if (avgSuccessRate >= 0.95) {
      console.log('  🟢 本周测试正常，配置稳定，建议继续加压测试');
    } else if (avgSuccessRate >= 0.85) {
      console.log('  🟡 本周有部分警告，但整体可控，建议保持当前配置');
    } else {
      console.log('  🟠 本周存在问题，建议检查并调整配置');
    }

    const markdownContent = this.generateWeeklyMarkdown(weekReports, weekNumber);
    const filename = path.join(REPORT_DIR, `weekly-report-week${weekNumber}.md`);
    fs.writeFileSync(filename, markdownContent);
    console.log(`\n📄 Markdown报告已保存: ${filename}`);

    console.log('\n' + '═'.repeat(70));

    return weekReports;
  }

  generateSummaryReport() {
    const reports = this.getAllReports();

    if (reports.length === 0) {
      console.log('❌ 未找到任何测试报告');
      return null;
    }

    console.log('\n' + '═'.repeat(70));
    console.log('📊 爬虫压力测试 - 最终总结报告');
    console.log('═'.repeat(70));

    console.log('\n📅 测试周期');
    console.log(`  开始日期: ${reports[0].date}`);
    console.log(`  结束日期: ${reports[reports.length - 1].date}`);
    console.log(`  总测试天数: ${reports.length}`);

    const totalRequests = reports.reduce((sum, r) => sum + r.metrics.totalRequests, 0);
    const totalSuccess = reports.reduce((sum, r) => sum + r.metrics.successRequests, 0);
    const avgSuccessRate = totalSuccess / totalRequests;
    const avgResponseTime = reports.reduce((sum, r) => sum + r.metrics.avgResponseTime, 0) / reports.length;

    console.log('\n📈 总体数据');
    console.log(`  总请求数: ${totalRequests}`);
    console.log(`  总成功数: ${totalSuccess} (${(avgSuccessRate * 100).toFixed(1)}%)`);
    console.log(`  平均响应时间: ${Math.round(avgResponseTime)}ms`);

    const allErrors = reports.reduce((acc, r) => {
      for (const [type, count] of Object.entries(r.metrics.errorDistribution)) {
        acc[type] = (acc[type] || 0) + count;
      }
      return acc;
    }, {});

    console.log('\n❌ 错误类型汇总');
    const errorTotal = Object.values(allErrors).reduce((a, b) => a + b, 0);
    for (const [type, count] of Object.entries(allErrors)) {
      const percentage = ((count / errorTotal) * 100).toFixed(1);
      console.log(`  ${type}: ${count} (${percentage}%)`);
    }

    const allAlerts = reports.flatMap(r => r.metrics.alerts || []);
    const criticalCount = allAlerts.filter(a => a.level === 'critical').length;
    const dangerCount = allAlerts.filter(a => a.level === 'danger').length;
    const warningCount = allAlerts.filter(a => a.level === 'warning').length;

    console.log('\n📝 告警汇总');
    console.log(`  严重告警: ${criticalCount}`);
    console.log(`  危险告警: ${dangerCount}`);
    console.log(`  警告告警: ${warningCount}`);

    const phaseStats = {};
    reports.forEach(r => {
      if (!phaseStats[r.phase]) {
        phaseStats[r.phase] = {
          successRates: [],
          responseTimes: [],
          config: r.config,
        };
      }
      phaseStats[r.phase].successRates.push(r.metrics.successRate);
      phaseStats[r.phase].responseTimes.push(r.metrics.avgResponseTime);
    });

    console.log('\n📊 各阶段性能');
    for (const [phase, stats] of Object.entries(phaseStats)) {
      const avgRate = stats.successRates.reduce((a, b) => a + b, 0) / stats.successRates.length;
      const avgTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
      const emoji = avgRate >= 0.95 ? '🟢' : avgRate >= 0.85 ? '🟡' : avgRate >= 0.60 ? '🟠' : '🔴';
      console.log(`  Phase ${phase}: 成功率${(avgRate * 100).toFixed(1)}% | 响应${Math.round(avgTime)}ms | ${emoji}`);
    }

    const bestPhase = Object.entries(phaseStats)
      .filter(([phase]) => parseInt(phase) >= 1 && parseInt(phase) <= 7)
      .sort((a, b) => {
        const avgRateA = a[1].successRates.reduce((x, y) => x + y, 0) / a[1].successRates.length;
        const avgRateB = b[1].successRates.reduce((x, y) => x + y, 0) / b[1].successRates.length;
        return avgRateB - avgRateA;
      })[0];

    console.log('\n🏆 推荐配置');
    if (bestPhase) {
      const config = bestPhase[1].config;
      console.log('  基于测试结果，推荐以下配置:');
      console.log(`    公众号数/批次: ${config.maxFeedsPerBatch}`);
      console.log(`    文章数/公众号: ${config.maxArticlesPerFeed}`);
      console.log(`    延迟范围: ${config.minDelaySeconds}-${config.maxDelaySeconds}秒`);
      console.log(`    批次间隔: ${config.batchIntervalSeconds}秒`);
      console.log(`    每日预算: ${config.dailyBudget}次`);

      const avgRate = bestPhase[1].successRates.reduce((a, b) => a + b, 0) / bestPhase[1].successRates.length;
      console.log(`    预期成功率: ${(avgRate * 100).toFixed(1)}%`);
    }

    const markdownContent = this.generateSummaryMarkdown(reports, phaseStats, bestPhase);
    const filename = path.join(REPORT_DIR, 'final-summary-report.md');
    fs.writeFileSync(filename, markdownContent);
    console.log(`\n📄 完整报告已保存: ${filename}`);

    console.log('\n' + '═'.repeat(70));

    return { reports, phaseStats, bestPhase };
  }

  generateMarkdownReport(report) {
    return `# 爬虫压力测试日报 - ${report.date}

## 测试配置

| 参数 | 值 |
|------|-----|
| 阶段 | Phase ${report.phase} |
| 公众号数/批次 | ${report.config.maxFeedsPerBatch} |
| 文章数/公众号 | ${report.config.maxArticlesPerFeed} |
| 延迟范围 | ${report.config.minDelaySeconds}-${report.config.maxDelaySeconds}秒 |
| 批次间隔 | ${report.config.batchIntervalSeconds}秒 |
| 每日预算 | ${report.config.dailyBudget}次 |

## 测试结果

| 指标 | 值 |
|------|-----|
| 总请求数 | ${report.metrics.totalRequests} |
| 成功请求 | ${report.metrics.successRequests} (${(report.metrics.successRate * 100).toFixed(1)}%) |
| 失败请求 | ${report.metrics.failedRequests} |
| 平均响应时间 | ${report.metrics.avgResponseTime}ms |
| 最小响应时间 | ${report.metrics.minResponseTime}ms |
| 最大响应时间 | ${report.metrics.maxResponseTime}ms |

## 错误分布

${Object.entries(report.metrics.errorDistribution)
  .filter(([_, count]) => count > 0)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n') || '无错误'}

## 告警记录

${report.metrics.alerts?.map(a => `- [${a.level.toUpperCase()}] ${a.message}`).join('\n') || '无告警'}

## 状态评估

**${report.status}**

${report.metrics.successRate >= 0.95 ? '正常 - 可继续当前配置或适当加压' :
  report.metrics.successRate >= 0.85 ? '警告 - 建议保持配置观察' :
  report.metrics.successRate >= 0.60 ? '危险 - 建议降低负载' :
  '封号风险 - 立即停止测试'}
`;
  }

  generateWeeklyMarkdown(reports, weekNumber) {
    const totalRequests = reports.reduce((sum, r) => sum + r.metrics.totalRequests, 0);
    const totalSuccess = reports.reduce((sum, r) => sum + r.metrics.successRequests, 0);
    const avgSuccessRate = totalSuccess / totalRequests;

    return `# 爬虫压力测试周报 - 第${weekNumber}周

## 测试概览

- 测试天数: ${reports.length}
- 测试阶段: Phase ${reports[0].phase} → Phase ${reports[reports.length - 1].phase}

## 本周汇总

| 指标 | 值 |
|------|-----|
| 总请求数 | ${totalRequests} |
| 总成功数 | ${totalSuccess} (${(avgSuccessRate * 100).toFixed(1)}%) |
| 平均响应时间 | ${Math.round(reports.reduce((sum, r) => sum + r.metrics.avgResponseTime, 0) / reports.length)}ms |

## 每日详情

| 日期 | 成功率 | 响应时间 | 状态 |
|------|--------|---------|------|
${reports.map(r =>
  `| ${r.date} | ${(r.metrics.successRate * 100).toFixed(1)}% | ${r.metrics.avgResponseTime}ms | ${r.status} |`
).join('\n')}

## 周评估

${avgSuccessRate >= 0.95 ? '🟢 本周测试正常，配置稳定，建议继续加压测试' :
  avgSuccessRate >= 0.85 ? '🟡 本周有部分警告，但整体可控，建议保持当前配置' :
  '🟠 本周存在问题，建议检查并调整配置'}
`;
  }

  generateSummaryMarkdown(reports, phaseStats, bestPhase) {
    const totalRequests = reports.reduce((sum, r) => sum + r.metrics.totalRequests, 0);
    const totalSuccess = reports.reduce((sum, r) => sum + r.metrics.successRequests, 0);
    const avgSuccessRate = totalSuccess / totalRequests;

    return `# 爬虫压力测试 - 最终总结报告

## 测试周期

- 开始日期: ${reports[0].date}
- 结束日期: ${reports[reports.length - 1].date}
- 总测试天数: ${reports.length}

## 总体数据

| 指标 | 值 |
|------|-----|
| 总请求数 | ${totalRequests} |
| 总成功数 | ${totalSuccess} (${(avgSuccessRate * 100).toFixed(1)}%) |
| 平均响应时间 | ${Math.round(reports.reduce((sum, r) => sum + r.metrics.avgResponseTime, 0) / reports.length)}ms |

## 各阶段性能

| 阶段 | 成功率 | 平均响应时间 | 状态 |
|------|--------|-------------|------|
${Object.entries(phaseStats)
  .map(([phase, stats]) => {
    const avgRate = stats.successRates.reduce((a, b) => a + b, 0) / stats.successRates.length;
    const avgTime = stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length;
    const status = avgRate >= 0.95 ? '🟢正常' : avgRate >= 0.85 ? '🟡警告' : avgRate >= 0.60 ? '🟠危险' : '🔴封号';
    return `| Phase ${phase} | ${(avgRate * 100).toFixed(1)}% | ${Math.round(avgTime)}ms | ${status} |`;
  }).join('\n')}

## 推荐配置

${bestPhase ? `
基于测试结果，推荐以下安全配置:

| 参数 | 推荐值 |
|------|--------|
| 公众号数/批次 | ${bestPhase[1].config.maxFeedsPerBatch} |
| 文章数/公众号 | ${bestPhase[1].config.maxArticlesPerFeed} |
| 延迟范围 | ${bestPhase[1].config.minDelaySeconds}-${bestPhase[1].config.maxDelaySeconds}秒 |
| 批次间隔 | ${bestPhase[1].config.batchIntervalSeconds}秒 |
| 每日预算 | ${bestPhase[1].config.dailyBudget}次 |

预期成功率: ${(bestPhase[1].successRates.reduce((a, b) => a + b, 0) / bestPhase[1].successRates.length * 100).toFixed(1)}%
` : '数据不足，无法推荐'}

## 测试结论

${avgSuccessRate >= 0.95 ? '✅ 测试通过，配置可投入生产使用' :
  avgSuccessRate >= 0.85 ? '⚠️ 测试基本通过，建议在生产环境中持续监控' :
  '❌ 测试未通过，需要调整配置后重新测试'}
`;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const reporter = new MonitorReporter();

  if (args.includes('--daily')) {
    const dateArg = args.find(a => a.startsWith('--date='));
    const date = dateArg ? dateArg.split('=')[1] : new Date().toISOString().split('T')[0];
    reporter.generateDailyReport(date);
  } else if (args.includes('--weekly')) {
    const weekArg = args.find(a => a.startsWith('--week='));
    const weekNumber = weekArg ? parseInt(weekArg.split('=')[1]) : 1;
    reporter.generateWeeklyReport(weekNumber);
  } else if (args.includes('--summary')) {
    reporter.generateSummaryReport();
  } else {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              爬虫压力测试监控报告生成器                            ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  使用方式:                                                         ║
║    node test/monitor-report.js --daily --date=2026-05-18         ║
║    node test/monitor-report.js --weekly --week=1                  ║
║    node test/monitor-report.js --summary                          ║
║                                                                  ║
║  参数说明:                                                         ║
║    --daily    生成每日报告 (需配合 --date=YYYY-MM-DD)             ║
║    --weekly   生成每周报告 (需配合 --week=N)                      ║
║    --summary  生成最终总结报告                                    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { MonitorReporter };
