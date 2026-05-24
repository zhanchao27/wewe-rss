/**
 * 方案B全文存储 - 综合压力测试脚本
 *
 * 测试目标：
 * 1. 公众号抓取上限测试（单批次最大公众号数）
 * 2. 抓取间隔测试（最小安全间隔时间）
 * 3. 综合压力测试（连续抓取稳定性）
 *
 * 使用方式：
 *   node test/comprehensive-pressure-test.js --test=account-limit    # 测试公众号上限
 *   node test/comprehensive-pressure-test.js --test=interval         # 测试抓取间隔
 *   node test/comprehensive-pressure-test.js --test=combined        # 综合压力测试
 *   node test/comprehensive-pressure-test.js --day=1                 # 指定第N天测试
 *   node test/comprehensive-pressure-test.js --report               # 生成测试报告
 *
 * 9天测试计划：
 *   Day 1-3: 公众号抓取上限测试
 *   Day 4-6: 抓取间隔测试
 *   Day 7-9: 综合压力测试
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
    accountLimit: {
      name: '公众号抓取上限测试',
      description: '测试单批次最大能安全抓取的公众号数量',
      days: 3,
      phases: [
        { name: 'Day1-小批量', day: 1, accounts: 3, articles: 5, delay: '30-60秒', dailyLimit: 30 },
        { name: 'Day1-增量测试', day: 1, accounts: 5, articles: 5, delay: '30-60秒', dailyLimit: 40 },
        { name: 'Day2-中批量', day: 2, accounts: 5, articles: 8, delay: '25-50秒', dailyLimit: 50 },
        { name: 'Day2-增量测试', day: 2, accounts: 7, articles: 8, delay: '25-50秒', dailyLimit: 60 },
        { name: 'Day3-大批量', day: 3, accounts: 8, articles: 10, delay: '20-45秒', dailyLimit: 80 },
        { name: 'Day3-极限测试', day: 3, accounts: 10, articles: 10, delay: '15-30秒', dailyLimit: 100 },
      ]
    },
    interval: {
      name: '抓取间隔测试',
      description: '测试不同间隔时间下的成功率',
      days: 3,
      phases: [
        { name: 'Day4-长间隔', day: 4, minDelay: 45, maxDelay: 90, description: '45-90秒间隔' },
        { name: 'Day4-标准测试', day: 4, minDelay: 30, maxDelay: 60, description: '30-60秒间隔' },
        { name: 'Day5-短间隔', day: 5, minDelay: 20, maxDelay: 40, description: '20-40秒间隔' },
        { name: 'Day5-稳定性测试', day: 5, minDelay: 25, maxDelay: 50, description: '25-50秒间隔' },
        { name: 'Day6-极限间隔', day: 6, minDelay: 10, maxDelay: 20, description: '10-20秒间隔' },
        { name: 'Day6-混合测试', day: 6, minDelay: 15, maxDelay: 35, description: '15-35秒间隔' },
      ]
    },
    combined: {
      name: '综合压力测试',
      description: '模拟实际生产环境的连续抓取',
      days: 3,
      phases: [
        { name: 'Day7-连续1小时', day: 7, duration: 60 * 60 * 1000, config: '标准', batchSize: 5, delay: '30-60秒' },
        { name: 'Day7-连续2小时', day: 7, duration: 2 * 60 * 60 * 1000, config: '标准', batchSize: 5, delay: '30-60秒' },
        { name: 'Day8-连续2小时', day: 8, duration: 2 * 60 * 60 * 1000, config: '高负载', batchSize: 8, delay: '20-45秒' },
        { name: 'Day8-连续3小时', day: 8, duration: 3 * 60 * 60 * 1000, config: '高负载', batchSize: 8, delay: '20-45秒' },
        { name: 'Day9-连续4小时', day: 9, duration: 4 * 60 * 60 * 1000, config: '极限', batchSize: 10, delay: '15-30秒' },
        { name: 'Day9-长时稳定性', day: 9, duration: 4 * 60 * 60 * 1000, config: '极限', batchSize: 10, delay: '15-30秒' },
      ]
    }
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

class ComprehensivePressureTest {
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
    this.currentPhase = null;
    this.isRunning = false;
    this.shouldStop = false;
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

  async getDatabaseArticles(limit = 50) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient({
        datasources: { db: { url: this.config?.database?.url || CONFIG.database.url } }
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

  async testAccountLimit(phase) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  📊 公众号抓取上限测试 - ${phase.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`配置: ${phase.accounts}个公众号, ${phase.articles}篇/公众号`);
    console.log(`延迟: ${phase.delay}, 每日上限: ${phase.dailyLimit}篇\n`);

    this.currentPhase = phase.name;
    const articles = await this.getDatabaseArticles(phase.accounts * phase.articles);

    if (articles.length === 0) {
      console.log('❌ 数据库中没有足够的文章进行测试');
      return null;
    }

    let success = 0;
    let failed = 0;

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
      console.log(`  [${progress}%] ${status} ${article.title.substring(0, 20)}... | ${result.responseTime}ms | ${size}`);

      if (i < articles.length - 1) {
        const delay = this.getRandomDelay(
          parseInt(phase.delay.split('-')[0]),
          parseInt(phase.delay.split('-')[1].replace('秒', ''))
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const successRate = (success / articles.length * 100).toFixed(2);
    console.log(`\n📊 ${phase.name} 结果: 成功 ${success}, 失败 ${failed}, 成功率 ${successRate}%`);

    return {
      phase: phase.name,
      day: phase.day,
      config: phase,
      total: articles.length,
      success,
      failed,
      successRate: parseFloat(successRate),
      errors: this.metrics.errors.slice(-10)
    };
  }

  async testInterval(phase) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ⏱️ 抓取间隔测试 - ${phase.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`配置: ${phase.description}`);
    console.log('');

    this.currentPhase = phase.name;
    const articles = await this.getDatabaseArticles(20);

    if (articles.length === 0) {
      console.log('❌ 数据库中没有足够的文章进行测试');
      return null;
    }

    let success = 0;
    let failed = 0;

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
      console.log(`  [${progress}%] ${status} ${article.title.substring(0, 20)}... | ${result.responseTime}ms`);

      if (i < articles.length - 1) {
        const delay = this.getRandomDelay(phase.minDelay, phase.maxDelay);
        console.log(`    ⏳ 等待 ${delay / 1000}秒...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const successRate = (success / articles.length * 100).toFixed(2);
    const avgInterval = (phase.minDelay + phase.maxDelay) / 2;
    console.log(`\n📊 ${phase.name} 结果:`);
    console.log(`  - 平均间隔: ${avgInterval}秒`);
    console.log(`  - 成功: ${success}, 失败: ${failed}`);
    console.log(`  - 成功率: ${successRate}%`);

    return {
      phase: phase.name,
      day: phase.day,
      config: phase,
      total: articles.length,
      success,
      failed,
      successRate: parseFloat(successRate),
      avgInterval,
      errors: this.metrics.errors.slice(-10)
    };
  }

  async testCombined(phase) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  🔥 综合压力测试 - ${phase.name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`配置: 持续运行 ${phase.duration / 1000 / 60} 分钟`);
    console.log(`批次大小: ${phase.batchSize}, 延迟: ${phase.delay}\n`);

    this.currentPhase = phase.name;
    this.metrics.startTime = Date.now();

    const config = {
      minDelay: parseInt(phase.delay.split('-')[0]),
      maxDelay: parseInt(phase.delay.split('-')[1].replace('秒', '')),
      batchSize: phase.batchSize
    };

    let batchCount = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    const endTime = Date.now() + phase.duration;

    while (Date.now() < endTime && !this.shouldStop) {
      batchCount++;
      console.log(`\n📦 Batch ${batchCount} 开始...`);

      const articles = await this.getDatabaseArticles(config.batchSize);

      for (let i = 0; i < articles.length && Date.now() < endTime && !this.shouldStop; i++) {
        const article = articles[i];
        const result = await this.fetchArticle(article.id);

        this.metrics.totalRequests++;
        if (result.success) {
          this.metrics.successRequests++;
          totalSuccess++;
        } else {
          this.metrics.failedRequests++;
          totalFailed++;
          this.metrics.errors.push({
            articleId: article.id,
            ...result
          });
        }

        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${article.title.substring(0, 15)}... | ${result.responseTime}ms`);

        if (i < articles.length - 1) {
          const delay = this.getRandomDelay(config.minDelay, config.maxDelay);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      const elapsed = Math.round((Date.now() - this.metrics.startTime) / 1000 / 60);
      const remaining = Math.round((endTime - Date.now()) / 1000 / 60);
      console.log(`  ⏱️ Batch ${batchCount} 完成 | 已运行 ${elapsed}分钟, 剩余 ${remaining}分钟`);

      const pauseTime = 60000;
      console.log(`  ⏸️ 批次间隔等待 ${pauseTime / 1000}秒...`);
      await new Promise(resolve => setTimeout(resolve, pauseTime));
    }

    this.metrics.endTime = Date.now();
    const totalTime = (this.metrics.endTime - this.metrics.startTime) / 1000;
    const successRate = (totalSuccess / (totalSuccess + totalFailed) * 100).toFixed(2);

    console.log(`\n📊 ${phase.name} 结果:`);
    console.log(`  - 总批次: ${batchCount}`);
    console.log(`  - 总请求: ${totalSuccess + totalFailed}`);
    console.log(`  - 成功: ${totalSuccess}, 失败: ${totalFailed}`);
    console.log(`  - 成功率: ${successRate}%`);
    console.log(`  - 总耗时: ${Math.round(totalTime / 60)}分钟`);

    return {
      phase: phase.name,
      day: phase.day,
      config: phase,
      batches: batchCount,
      total: totalSuccess + totalFailed,
      success: totalSuccess,
      failed: totalFailed,
      successRate: parseFloat(successRate),
      duration: totalTime,
      errors: this.metrics.errors.slice(-20)
    };
  }

  async runTest(testType, specificDay = null) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║       方案B全文存储 - 9天综合压力测试                      ║
╚══════════════════════════════════════════════════════════════╝
    `);

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

    let testConfig;
    let testFn;

    if (testType === 'account-limit') {
      testConfig = CONFIG.test.accountLimit;
      testFn = (p) => this.testAccountLimit(p);
    } else if (testType === 'interval') {
      testConfig = CONFIG.test.interval;
      testFn = (p) => this.testInterval(p);
    } else if (testType === 'combined') {
      testConfig = CONFIG.test.combined;
      testFn = (p) => this.testCombined(p);
    } else {
      console.error('未知的测试类型:', testType);
      return;
    }

    console.log(`测试类型: ${testConfig.name}`);
    console.log(`测试天数: ${testConfig.days}天`);
    console.log(`总阶段数: ${testConfig.phases.length}\n`);

    const results = [];
    const phases = specificDay
      ? testConfig.phases.filter(p => p.day === specificDay)
      : testConfig.phases;

    for (const phase of phases) {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`📅 第${phase.day}天测试 - ${testConfig.name}`);
      console.log(`${'─'.repeat(60)}`);

      const result = await testFn(phase);
      if (result) {
        results.push(result);
        this.metrics.phaseResults.push(result);
      }

      const currentPhaseIndex = phases.indexOf(phase);
      if (currentPhaseIndex < phases.length - 1) {
        const nextPhase = phases[currentPhaseIndex + 1];
        if (nextPhase.day !== phase.day) {
          console.log(`\n⏰ 第${phase.day}天测试完成，暂停2分钟后开始第${nextPhase.day}天...`);
          await new Promise(resolve => setTimeout(resolve, 120000));
        } else {
          console.log(`\n⏳ 阶段间暂停30秒...`);
          await new Promise(resolve => setTimeout(resolve, 30000));
        }
      }
    }

    this.metrics.endTime = Date.now();
    this.saveReport(results, testType, specificDay);
    this.printSummary(results, testType);
  }

  saveReport(results, testType, specificDay) {
    const reportDir = path.join(__dirname, 'data', 'comprehensive-test', '9day');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const date = new Date().toISOString().split('T')[0];
    const dayLabel = specificDay ? `-day${specificDay}` : '';
    const report = {
      date,
      testType,
      days: specificDay || 'all',
      summary: {
        totalRequests: this.metrics.totalRequests,
        successRequests: this.metrics.successRequests,
        failedRequests: this.metrics.failedRequests,
        overallSuccessRate: (this.metrics.successRequests / this.metrics.totalRequests * 100).toFixed(2)
      },
      phaseResults: results,
      errors: this.metrics.errors.slice(0, 50)
    };

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
      'account-limit': '公众号抓取上限测试',
      'interval': '抓取间隔测试',
      'combined': '综合压力测试'
    };

    let content = `# 📊 方案B综合压力测试报告 (9天计划)

**测试类型**: ${typeNames[report.testType]}
**测试日期**: ${report.date}
**测试天数**: ${report.days === 'all' ? '全部' : `Day ${report.days}`}
**总请求数**: ${report.summary.totalRequests}
**成功率**: ${report.summary.overallSuccessRate}%

---

## 测试配置

| 阶段 | 天数 | 配置 |
|------|------|------|
`;

    report.phaseResults.forEach(r => {
      if (report.testType === 'account-limit') {
        content += `| ${r.phase} | Day ${r.day} | ${r.config.accounts}个公众号, ${r.config.articles}篇/公众号, 延迟${r.config.delay} |\n`;
      } else if (report.testType === 'interval') {
        content += `| ${r.phase} | Day ${r.day} | 间隔${r.config.minDelay}-${r.config.maxDelay}秒 |\n`;
      } else {
        content += `| ${r.phase} | Day ${r.day} | 持续${Math.round(r.duration / 60)}分钟, ${r.config.batchSize}个/批 |\n`;
      }
    });

    content += `
---

## 测试结果

| 阶段 | 天数 | 总数 | 成功 | 失败 | 成功率 | 状态 |
|------|------|------|------|------|--------|------|
`;

    report.phaseResults.forEach(r => {
      const status = r.successRate >= 95 ? '🟢 正常' : r.successRate >= 85 ? '🟡 警告' : '🔴 危险';
      content += `| ${r.phase} | Day ${r.day} | ${r.total} | ${r.success} | ${r.failed} | ${r.successRate}% | ${status} |\n`;
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

## 推荐配置

| 参数 | 推荐值 | 测试确认 |
|------|--------|----------|
`;

    if (report.testType === 'account-limit') {
      const bestResult = report.phaseResults.reduce((best, r) => r.successRate > best.successRate ? r : best);
      content += `| 单批次公众号数 | ${bestResult.config.accounts}个 | 成功率 ${bestResult.successRate}% |\n`;
      content += `| 每日抓取上限 | ${bestResult.config.dailyLimit}篇 | 成功率 ${bestResult.successRate}% |\n`;
    } else if (report.testType === 'interval') {
      const safeResults = report.phaseResults.filter(r => r.successRate >= 95);
      if (safeResults.length > 0) {
        const safest = safeResults.reduce((min, r) => r.avgInterval < min.avgInterval ? r : min);
        content += `| 安全间隔 | ${safest.config.minDelay}-${safest.config.maxDelay}秒 | 成功率 ${safest.successRate}% |\n`;
      }
    } else {
      const stableResults = report.phaseResults.filter(r => r.successRate >= 92);
      if (stableResults.length > 0) {
        const longest = stableResults.reduce((max, r) => r.duration > max.duration ? r : max);
        content += `| 连续运行时间 | ${Math.round(longest.duration / 60)}分钟 | 成功率 ${longest.successRate}% |\n`;
        content += `| 批次配置 | ${longest.config.batchSize}个/批 | 成功率 ${longest.successRate}% |\n`;
      }
    }

    content += `
---

*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`;

    return content;
  }

  printSummary(results, testType) {
    console.log(`
${'='.repeat(60)}
📊 测试完成 - 结果汇总
${'='.repeat(60)}
    `);

    const typeNames = {
      'account-limit': '公众号抓取上限测试',
      'interval': '抓取间隔测试',
      'combined': '综合压力测试'
    };

    console.log(`测试类型: ${typeNames[testType]}`);
    console.log(`总请求数: ${this.metrics.totalRequests}`);
    console.log(`成功: ${this.metrics.successRequests}`);
    console.log(`失败: ${this.metrics.failedRequests}`);
    console.log(`总体成功率: ${(this.metrics.successRequests / this.metrics.totalRequests * 100).toFixed(2)}%`);

    console.log(`\n各阶段结果:`);
    results.forEach(r => {
      const status = r.successRate >= 95 ? '✅' : r.successRate >= 85 ? '⚠️' : '❌';
      console.log(`  ${status} ${r.phase}: ${r.successRate}% (${r.success}/${r.total})`);
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
  const testType = args.find(arg => arg.startsWith('--test='))?.split('=')[1] || 'account-limit';
  const specificDay = args.find(arg => arg.startsWith('--day='))?.split('=')[1];

  const tester = new ComprehensivePressureTest();

  process.on('SIGINT', () => {
    tester.stop();
    setTimeout(() => process.exit(0), 1000);
  });

  tester.runTest(testType, specificDay ? parseInt(specificDay) : null);
}

module.exports = ComprehensivePressureTest;