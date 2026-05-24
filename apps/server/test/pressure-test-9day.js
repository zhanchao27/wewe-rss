/**
 * 方案B全文存储 - 9天渐进式压力测试脚本
 *
 * 测试逻辑（从基础到复杂）:
 * 1. Day 1-3: 文章数量测试 - 固定公众号数，逐步增加文章数
 * 2. Day 4-6: 公众号数量测试 - 基于最大文章数，逐步增加公众号数
 * 3. Day 7-9: 间隔时间测试 - 基于最大文章+公众号，逐步缩短间隔
 *
 * 使用方式：
 *   node test/pressure-test-9day.js --test=article-count    # Day 1-3: 文章数量测试
 *   node test/pressure-test-9day.js --test=account-count    # Day 4-6: 公众号数量测试
 *   node test/pressure-test-9day.js --test=interval         # Day 7-9: 间隔时间测试
 *   node test/pressure-test-9day.js --day=N                # 指定第N天测试
 *   node test/pressure-test-9day.js --run-all              # 运行全部9天测试
 */

const got = require('got');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  database: {
    url: process.env.DATABASE_URL || 'file:../data/wewe-rss.db'
  },
  test: {
    articleCount: {
      name: '文章数量测试',
      description: '测试单日最大文章抓取量（固定公众号数，逐步增加文章数）',
      days: 3,
      phases: [
        { name: 'Day1-基线', day: 1, accounts: 3, articlesPerAccount: 5, totalArticles: 15, delay: '30-60秒' },
        { name: 'Day2-增量', day: 2, accounts: 3, articlesPerAccount: 10, totalArticles: 30, delay: '30-60秒' },
        { name: 'Day3-极限', day: 3, accounts: 3, articlesPerAccount: 15, totalArticles: 45, delay: '30-60秒' },
      ]
    },
    accountCount: {
      name: '公众号数量测试',
      description: '测试在最大文章数基础上能抓多少公众号',
      days: 3,
      phases: [
        { name: 'Day4-小批量', day: 4, accounts: 5, articlesPerAccount: 10, totalArticles: 50, delay: '30-60秒' },
        { name: 'Day5-中批量', day: 5, accounts: 8, articlesPerAccount: 10, totalArticles: 80, delay: '25-50秒' },
        { name: 'Day6-大批量', day: 6, accounts: 10, articlesPerAccount: 10, totalArticles: 100, delay: '20-45秒' },
      ]
    },
    interval: {
      name: '间隔时间测试',
      description: '在最大文章+公众号基础上测试最安全间隔',
      days: 3,
      phases: [
        { name: 'Day7-长间隔', day: 7, accounts: 8, articlesPerAccount: 10, totalArticles: 80, delay: '45-90秒' },
        { name: 'Day8-标准间隔', day: 8, accounts: 8, articlesPerAccount: 10, totalArticles: 80, delay: '30-60秒' },
        { name: 'Day9-短间隔', day: 9, accounts: 8, articlesPerAccount: 10, totalArticles: 80, delay: '20-40秒' },
      ]
    }
  },
  successThreshold: {
    articleCount: 95,
    accountCount: 92,
    interval: 90
  },
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  ]
};

const USER_AGENTS = CONFIG.userAgents;
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'wewe-rss.db');

class PressureTest9Day {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      errors: [],
      startTime: null,
      endTime: null,
      phaseResults: []
    };
    this.shouldStop = false;
    this.testResults = {};
  }

  getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min) + min) * 1000;
  }

  async fetchArticle(articleId) {
    const articleUrl = `https://mp.weixin.qq.com/s/${articleId}`;
    const startTime = Date.now();

    try {
      const response = await got(articleUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: { request: 15000 },
      });

      const $ = cheerio.load(response.body);
      const title = $('#activity-name').text().trim() || '无标题';
      const author = $('#js_name').text().trim() || '未知作者';
      const content = $('.rich_media_content').html() || '';
      const contentLength = content.length;

      return {
        success: true,
        articleId,
        title,
        author,
        contentLength,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        articleId,
        errorType: this.getErrorType(error),
        errorMessage: error.message,
        responseTime: Date.now() - startTime,
      };
    }
  }

  getErrorType(error) {
    if (error.response) {
      const status = error.response.statusCode;
      if (status === 403) return '403_禁止访问';
      if (status === 429) return '429_请求过多';
      if (status >= 500) return '5xx_服务器错误';
      return `HTTP_${status}`;
    }
    if (error.code === 'ETIMEDOUT') return '超时';
    if (error.code === 'ECONNREFUSED') return '连接被拒绝';
    return '网络错误';
  }

  async getDatabaseArticles(limit = 100) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient({
        datasources: { db: { url: CONFIG.database.url } }
      });

      const articles = await prisma.article.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, feedId: true }
      });

      await prisma.$disconnect();
      return articles;
    } catch (error) {
      console.error('数据库查询失败:', error.message);
      return [];
    }
  }

  async runPhase(phase, testType) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📅 ${phase.name}`);
    console.log(`${'─'.repeat(60)}`);
    console.log(`配置: ${phase.accounts}个公众号 × ${phase.articlesPerAccount}篇/公众号 = ${phase.totalArticles}篇`);
    console.log(`延迟: ${phase.delay}`);
    console.log('');

    const articles = await this.getDatabaseArticles(phase.totalArticles);

    if (articles.length === 0) {
      console.log('❌ 数据库中没有足够的文章进行测试');
      return null;
    }

    if (articles.length < phase.totalArticles) {
      console.log(`⚠️  数据库中只有 ${articles.length} 篇文章，少于需求的 ${phase.totalArticles} 篇`);
    }

    let success = 0;
    let failed = 0;
    const delayMin = parseInt(phase.delay.split('-')[0]);
    const delayMax = parseInt(phase.delay.split('-')[1].replace('秒', ''));

    for (let i = 0; i < articles.length && !this.shouldStop; i++) {
      const article = articles[i];
      const result = await this.fetchArticle(article.id);

      this.metrics.totalRequests++;
      if (result.success) {
        this.metrics.successRequests++;
        success++;
      } else {
        this.metrics.failedRequests++;
        failed++;
        this.metrics.errors.push({
          articleId: article.id,
          ...result
        });
      }

      const progress = ((i + 1) / articles.length * 100).toFixed(0);
      const status = result.success ? '✅' : '❌';
      const size = result.contentLength ? `${(result.contentLength / 1024).toFixed(1)}KB` : '-';
      console.log(`  [${progress}%] ${status} ${article.title.substring(0, 18)}.. | ${result.responseTime}ms | ${size}`);

      if (i < articles.length - 1) {
        const delay = this.getRandomDelay(delayMin, delayMax);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const successRate = (success / articles.length * 100).toFixed(2);
    const threshold = CONFIG.successThreshold[testType] || 90;
    const status = successRate >= threshold ? '🟢 通过' : successRate >= threshold - 10 ? '🟡 警告' : '🔴 危险';

    console.log(`\n📊 ${phase.name} 结果:`);
    console.log(`  - 成功: ${success}/${articles.length}`);
    console.log(`  - 失败: ${failed}`);
    console.log(`  - 成功率: ${successRate}% (阈值: ${threshold}%)`);
    console.log(`  - 状态: ${status}`);

    return {
      phase: phase.name,
      day: phase.day,
      config: {
        accounts: phase.accounts,
        articlesPerAccount: phase.articlesPerAccount,
        totalArticles: phase.totalArticles,
        delay: phase.delay
      },
      total: articles.length,
      success,
      failed,
      successRate: parseFloat(successRate),
      threshold,
      status: successRate >= threshold ? 'pass' : successRate >= threshold - 10 ? 'warning' : 'danger',
      errors: this.metrics.errors.slice(-10)
    };
  }

  async runTest(testType, specificDay = null) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║       方案B - 9天渐进式压力测试                          ║
╚══════════════════════════════════════════════════════════════╝
    `);

    let testConfig;
    if (testType === 'article-count') {
      testConfig = CONFIG.test.articleCount;
    } else if (testType === 'account-count') {
      testConfig = CONFIG.test.accountCount;
    } else if (testType === 'interval') {
      testConfig = CONFIG.test.interval;
    } else {
      console.error('未知的测试类型:', testType);
      return;
    }

    console.log(`测试类型: ${testConfig.name}`);
    console.log(`测试天数: Day ${testConfig.days > 1 ? `${specificDay || 'all'}` : specificDay}`);
    console.log(`说明: ${testConfig.description}\n`);

    this.metrics = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      errors: [],
      startTime: Date.now(),
      endTime: null,
      phaseResults: []
    };
    this.shouldStop = false;

    const phases = specificDay
      ? testConfig.phases.filter(p => p.day === specificDay)
      : testConfig.phases;

    const results = [];

    for (const phase of phases) {
      const result = await this.runPhase(phase, testType);
      if (result) {
        results.push(result);
        this.metrics.phaseResults.push(result);
      }

      if (!this.shouldStop && phases.indexOf(phase) < phases.length - 1) {
        console.log(`\n⏳ 阶段间暂停2分钟...\n`);
        await new Promise(resolve => setTimeout(resolve, 120000));
      }
    }

    this.metrics.endTime = Date.now();
    this.saveReport(results, testType, specificDay);
    this.printSummary(results, testConfig.name);

    return results;
  }

  async runAllTests() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║       方案B - 9天完整压力测试                             ║
║                                                              ║
║  Day 1-3: 文章数量测试                                     ║
║  Day 4-6: 公众号数量测试                                   ║
║  Day 7-9: 间隔时间测试                                     ║
╚══════════════════════════════════════════════════════════════╝
    `);

    this.testResults = {};

    console.log('\n========================================');
    console.log('第一阶段: Day 1-3 文章数量测试');
    console.log('========================================\n');
    this.testResults['article-count'] = await this.runTest('article-count');

    console.log('\n========================================');
    console.log('第二阶段: Day 4-6 公众号数量测试');
    console.log('========================================\n');
    this.testResults['account-count'] = await this.runTest('account-count');

    console.log('\n========================================');
    console.log('第三阶段: Day 7-9 间隔时间测试');
    console.log('========================================\n');
    this.testResults['interval'] = await this.runTest('interval');

    this.generateFinalReport();
  }

  saveReport(results, testType, specificDay) {
    const reportDir = path.join(__dirname, 'data', '9day-pressure-test');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const date = new Date().toISOString().split('T')[0];
    const typeLabels = {
      'article-count': '文章数量',
      'account-count': '公众号数量',
      'interval': '间隔时间'
    };
    const typeLabel = typeLabels[testType] || testType;

    const report = {
      date,
      testType,
      typeLabel,
      summary: {
        totalRequests: this.metrics.totalRequests,
        successRequests: this.metrics.successRequests,
        failedRequests: this.metrics.failedRequests,
        overallSuccessRate: (this.metrics.successRequests / this.metrics.totalRequests * 100).toFixed(2)
      },
      phaseResults: results,
      errors: this.metrics.errors.slice(0, 50)
    };

    const dayLabel = specificDay ? `-day${specificDay}` : '-all';
    const jsonFile = path.join(reportDir, `${date}-${testType}${dayLabel}-report.json`);
    fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2));

    const mdContent = this.generateMarkdownReport(report);
    const mdFile = path.join(reportDir, `${date}-${testType}${dayLabel}-report.md`);
    fs.writeFileSync(mdFile, mdContent);

    console.log(`\n📄 报告已保存:`);
    console.log(`  JSON: ${jsonFile}`);
    console.log(`  Markdown: ${mdFile}`);
  }

  generateMarkdownReport(report) {
    const typeNames = {
      'article-count': '文章数量测试',
      'account-count': '公众号数量测试',
      'interval': '间隔时间测试'
    };

    let content = `# 📊 ${report.typeLabel}测试报告

**测试类型**: ${typeNames[report.testType]}
**测试日期**: ${report.date}
**总请求数**: ${report.summary.totalRequests}
**成功率**: ${report.summary.overallSuccessRate}%

---

## 测试配置

| 阶段 | 天数 | 公众号数 | 文章/公众号 | 总文章数 | 延迟 |
|------|------|----------|-------------|----------|------|
`;

    report.phaseResults.forEach(r => {
      content += `| ${r.phase} | Day ${r.day} | ${r.config.accounts} | ${r.config.articlesPerAccount} | ${r.config.totalArticles} | ${r.config.delay} |\n`;
    });

    content += `
---

## 测试结果

| 阶段 | 天数 | 总数 | 成功 | 失败 | 成功率 | 阈值 | 状态 |
|------|------|------|------|------|--------|------|------|
`;

    report.phaseResults.forEach(r => {
      const statusIcon = r.status === 'pass' ? '🟢' : r.status === 'warning' ? '🟡' : '🔴';
      content += `| ${r.phase} | Day ${r.day} | ${r.total} | ${r.success} | ${r.failed} | ${r.successRate}% | ${r.threshold}% | ${statusIcon} |\n`;
    });

    content += `
---

## 错误统计

| 错误类型 | 次数 |
|---------|------|
`;

    const errorCounts = {};
    report.errors.forEach(e => {
      const type = e.errorType || '未知错误';
      errorCounts[type] = (errorCounts[type] || 0) + 1;
    });
    Object.entries(errorCounts).forEach(([type, count]) => {
      content += `| ${type} | ${count} |\n`;
    });

    content += `
---

*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`;

    return content;
  }

  generateFinalReport() {
    const reportDir = path.join(__dirname, 'data', '9day-pressure-test');
    const date = new Date().toISOString().split('T')[0];

    let content = `# 📊 9天压力测试 - 最终报告

**测试完成日期**: ${date}
**整体总请求数**: ${Object.values(this.testResults).reduce((sum, r) => sum + (r?.summary?.totalRequests || 0), 0)}
**整体成功率**: ${((Object.values(this.testResults).reduce((sum, r) => sum + (r?.summary?.successRequests || 0), 0) / Object.values(this.testResults).reduce((sum, r) => sum + (r?.summary?.totalRequests || 1), 0)) * 100).toFixed(2)}%

---

## 测试结果汇总

### Day 1-3: 文章数量测试
`;

    if (this.testResults['article-count']) {
      const results = this.testResults['article-count'];
      const passResults = results.filter(r => r.status === 'pass');
      const recommended = passResults.length > 0 ? passResults[passResults.length - 1] : results[results.length - 1];

      content += `| 阶段 | 天数 | 公众号数 | 文章数 | 成功率 | 状态 |
|------|------|----------|--------|--------|------|
`;
      results.forEach(r => {
        const statusIcon = r.status === 'pass' ? '🟢' : r.status === 'warning' ? '🟡' : '🔴';
        content += `| ${r.phase} | Day ${r.day} | ${r.config.accounts} | ${r.config.totalArticles} | ${r.successRate}% | ${statusIcon} |\n`;
      });

      content += `\n**推荐**: 单日最大文章数 **${recommended?.config?.totalArticles || '?'}篇** (成功率 ${recommended?.successRate}%)\n`;
    }

    content += `
---

### Day 4-6: 公众号数量测试
`;

    if (this.testResults['account-count']) {
      const results = this.testResults['account-count'];
      const passResults = results.filter(r => r.status === 'pass');
      const recommended = passResults.length > 0 ? passResults[passResults.length - 1] : results[results.length - 1];

      content += `| 阶段 | 天数 | 公众号数 | 文章数 | 成功率 | 状态 |
|------|------|----------|--------|--------|------|
`;
      results.forEach(r => {
        const statusIcon = r.status === 'pass' ? '🟢' : r.status === 'warning' ? '🟡' : '🔴';
        content += `| ${r.phase} | Day ${r.day} | ${r.config.accounts} | ${r.config.totalArticles} | ${r.successRate}% | ${statusIcon} |\n`;
      });

      content += `\n**推荐**: 最大公众号数 **${recommended?.config?.accounts || '?'}个** (成功率 ${recommended?.successRate}%)\n`;
    }

    content += `
---

### Day 7-9: 间隔时间测试
`;

    if (this.testResults['interval']) {
      const results = this.testResults['interval'];
      const passResults = results.filter(r => r.status === 'pass');
      const recommended = passResults.length > 0 ? passResults[passResults.length - 1] : results[results.length - 1];

      content += `| 阶段 | 天数 | 间隔 | 公众号数 | 文章数 | 成功率 | 状态 |
|------|------|------|----------|--------|--------|------|
`;
      results.forEach(r => {
        const statusIcon = r.status === 'pass' ? '🟢' : r.status === 'warning' ? '🟡' : '🔴';
        content += `| ${r.phase} | Day ${r.day} | ${r.config.delay} | ${r.config.accounts} | ${r.config.totalArticles} | ${r.successRate}% | ${statusIcon} |\n`;
      });

      content += `\n**推荐**: 安全间隔 **${recommended?.config?.delay || '?'}** (成功率 ${recommended?.successRate}%)\n`;
    }

    content += `
---

## 最终推荐配置

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 单日最大文章数 | 待测试确认 | Day 1-3 确定 |
| 单批次最大公众号数 | 待测试确认 | Day 4-6 确定 |
| 安全间隔时间 | 待测试确认 | Day 7-9 确定 |
| 每日安全抓取量 | 待测试确认 | 综合结果 |

---

*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`;

    const finalReportFile = path.join(reportDir, `${date}-FINAL-report.md`);
    fs.writeFileSync(finalReportFile, content);
    console.log(`\n📄 最终报告已保存: ${finalReportFile}`);
  }

  printSummary(results, testName) {
    console.log(`
${'─'.repeat(60)}
📊 ${testName} - 结果汇总
${'─'.repeat(60)}
    `);

    console.log(`总请求数: ${this.metrics.totalRequests}`);
    console.log(`成功: ${this.metrics.successRequests}`);
    console.log(`失败: ${this.metrics.failedRequests}`);
    console.log(`总体成功率: ${(this.metrics.successRequests / this.metrics.totalRequests * 100).toFixed(2)}%`);

    console.log(`\n各阶段结果:`);
    results.forEach(r => {
      const statusIcon = r.status === 'pass' ? '✅' : r.status === 'warning' ? '⚠️' : '❌';
      console.log(`  ${statusIcon} ${r.phase}: ${r.successRate}% (${r.success}/${r.total})`);
    });

    if (this.metrics.errors.length > 0) {
      console.log(`\n主要错误:`);
      const errorCounts = {};
      this.metrics.errors.forEach(e => {
        const type = e.errorType || '未知错误';
        errorCounts[type] = (errorCounts[type] || 0) + 1;
      });
      Object.entries(errorCounts).slice(0, 5).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}次`);
      });
    }
  }

  stop() {
    console.log('\n🛑 正在停止测试...');
    this.shouldStop = true;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const testType = args.find(arg => arg.startsWith('--test='))?.split('=')[1] || 'article-count';
  const specificDay = args.find(arg => arg.startsWith('--day='))?.split('=')[1];
  const runAll = args.includes('--run-all');

  const tester = new PressureTest9Day();

  process.on('SIGINT', () => {
    tester.stop();
    setTimeout(() => process.exit(0), 1000);
  });

  if (runAll) {
    tester.runAllTests();
  } else {
    tester.runTest(testType, specificDay ? parseInt(specificDay) : null);
  }
}

module.exports = PressureTest9Day;