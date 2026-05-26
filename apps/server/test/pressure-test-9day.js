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
        { name: 'Day4-小批量', day: 4, accounts: 10, articlesPerAccount: 10, totalArticles: 100, delay: '30-60秒' },
        { name: 'Day5-中批量', day: 5, accounts: 20, articlesPerAccount: 10, totalArticles: 200, delay: '25-50秒' },
        { name: 'Day6-大批量', day: 6, accounts: 40, articlesPerAccount: 10, totalArticles: 400, delay: '20-45秒' },
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
    this.logger = {
      info: (msg, ...args) => console.log(`[${this.getTimestamp()}] ℹ️  ${msg}`, ...args),
      success: (msg, ...args) => console.log(`[${this.getTimestamp()}] ✅ ${msg}`, ...args),
      warn: (msg, ...args) => console.warn(`[${this.getTimestamp()}] ⚠️  ${msg}`, ...args),
      error: (msg, ...args) => console.error(`[${this.getTimestamp()}] ❌ ${msg}`, ...args),
      debug: (msg, ...args) => console.log(`[${this.getTimestamp()}] 🔍 ${msg}`, ...args),
    };
  }

  getTimestamp() {
    return new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }

  getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min) + min) * 1000;
  }

  async fetchArticle(articleId, index, total) {
    const articleUrl = `https://mp.weixin.qq.com/s/${articleId}`;
    const startTime = Date.now();
    const userAgent = this.getRandomUserAgent();

    this.logger.debug(`[${index + 1}/${total}] 开始抓取文章: ${articleId}`);

    try {
      const response = await got(articleUrl, {
        headers: {
          'User-Agent': userAgent,
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
      const responseTime = Date.now() - startTime;

      this.logger.debug(`[${index + 1}/${total}] 解析完成: "${title.substring(0, 20)}..." | ${responseTime}ms | ${(contentLength / 1024).toFixed(1)}KB`);

      return {
        success: true,
        articleId,
        title,
        author,
        contentLength,
        responseTime,
      };
    } catch (error) {
      const errorType = this.getErrorType(error);
      const responseTime = Date.now() - startTime;

      this.logger.warn(`[${index + 1}/${total}] 抓取失败: ${errorType} | ${articleId} | ${responseTime}ms`);

      return {
        success: false,
        articleId,
        errorType,
        errorMessage: error.message,
        responseTime,
      };
    }
  }

  getErrorType(error) {
    if (error.response) {
      const status = error.response.statusCode;
      if (status === 403) return '403_禁止访问(可能被封号)';
      if (status === 429) return '429_请求过多(触发限流)';
      if (status >= 500) return '5xx_服务器错误(微信服务端异常)';
      return `HTTP_${status}`;
    }
    if (error.code === 'ETIMEDOUT') return '请求超时';
    if (error.code === 'ECONNREFUSED') return '连接被拒绝';
    if (error.code === 'ENOTFOUND') return '域名解析失败';
    return '网络错误';
  }

  async checkDatabaseConnection() {
    this.logger.info('正在连接数据库...');
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient({
        datasources: { db: { url: CONFIG.database.url } }
      });

      const articleCount = await prisma.article.count();
      const feedCount = await prisma.feed.count();

      this.logger.success(`数据库连接成功 | 文章数: ${articleCount} | 订阅源数: ${feedCount}`);

      await prisma.$disconnect();
      return { articleCount, feedCount };
    } catch (error) {
      this.logger.error(`数据库连接失败: ${error.message}`);
      return null;
    }
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
        select: { id: true, title: true, mpId: true }
      });

      await prisma.$disconnect();
      return articles;
    } catch (error) {
      this.logger.error(`查询文章失败: ${error.message}`);
      return [];
    }
  }

  async getFeedsFromDatabase(count = 10) {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient({
        datasources: { db: { url: CONFIG.database.url } }
      });

      const feeds = await prisma.feed.findMany({
        where: { status: 1 },
        take: count,
        select: { id: true, mpName: true }
      });

      await prisma.$disconnect();
      return feeds;
    } catch (error) {
      this.logger.error(`查询订阅源失败: ${error.message}`);
      return [];
    }
  }

  async runPhase(phase, testType) {
    console.log(`\n${'═'.repeat(65)}`);
    console.log(`📅 ${phase.name} - 开始执行`);
    console.log(`${'═'.repeat(65)}`);
    this.logger.info(`测试类型: ${testType} | 公众号数: ${phase.accounts} | 文章/公众号: ${phase.articlesPerAccount}`);
    this.logger.info(`总目标: ${phase.totalArticles}篇 | 延迟: ${phase.delay}`);

    const phaseStartTime = Date.now();
    let articles = [];

    if (testType === 'account-count') {
      this.logger.info(`[模式] 公众号数量测试 - 从订阅源获取文章`);
      const feeds = await this.getFeedsFromDatabase(phase.accounts);
      this.logger.success(`已获取 ${feeds.length} 个订阅源`);

      if (feeds.length < phase.accounts) {
        this.logger.warn(`订阅源数量不足! 请求: ${phase.accounts}, 实际: ${feeds.length}`);
      }

      this.logger.info(`开始为每个订阅源获取文章...`);
      for (const feed of feeds) {
        this.logger.debug(`处理订阅源: ${feed.mpName} (${feed.id})`);
        const feedArticles = await this.getDatabaseArticles(phase.articlesPerAccount * 2);
        const filteredArticles = feedArticles.filter(a => a.mpId === feed.id);
        articles.push(...filteredArticles.map(a => ({ ...a, feedName: feed.mpName })));

        if (articles.length >= phase.totalArticles) {
          this.logger.debug(`已达到目标文章数 ${phase.totalArticles}，停止获取`);
          break;
        }
      }

      if (articles.length === 0) {
        this.logger.error(`没有找到任何文章进行测试!`);
        return null;
      }

      this.logger.success(`共获取 ${articles.length} 篇文章用于测试`);
    } else {
      this.logger.info(`[模式] 文章数量测试 - 从数据库获取最新文章`);
      articles = await this.getDatabaseArticles(phase.totalArticles);
      this.logger.success(`从数据库获取到 ${articles.length} 篇文章`);
    }

    if (articles.length === 0) {
      this.logger.error(`数据库中没有足够的文章进行测试`);
      return null;
    }

    if (articles.length < phase.totalArticles) {
      this.logger.warn(`文章数量不足 | 目标: ${phase.totalArticles} | 实际: ${articles.length}`);
    }

    let success = 0;
    let failed = 0;
    const delayMin = parseInt(phase.delay.split('-')[0]);
    const delayMax = parseInt(phase.delay.split('-')[1].replace('秒', ''));

    this.logger.info(`开始抓取测试... 预计耗时: ${Math.round((articles.length * (delayMin + delayMax) / 2 + articles.length * 2) / 1000 / 60)}分钟`);

    for (let i = 0; i < articles.length && !this.shouldStop; i++) {
      const article = articles[i];
      const result = await this.fetchArticle(article.id, i, articles.length);

      this.metrics.totalRequests++;
      if (result.success) {
        this.metrics.successRequests++;
        success++;
      } else {
        this.metrics.failedRequests++;
        failed++;
        this.metrics.errors.push({
          articleId: article.id,
          title: article.title,
          feedName: article.feedName || 'unknown',
          ...result
        });

        if (result.errorType.includes('403') || result.errorType.includes('429')) {
          this.logger.error(`⚠️  检测到封号/限流信号: ${result.errorType} | 建议立即停止测试`);
        }
      }

      const progress = ((i + 1) / articles.length * 100).toFixed(1);
      const status = result.success ? '✅' : '❌';
      const size = result.contentLength ? `${(result.contentLength / 1024).toFixed(1)}KB` : '-';
      const title = article.title ? article.title.substring(0, 15) : '无标题';

      process.stdout.write(`\r  [${progress}%] ${status} ${title}.. | ${result.responseTime}ms | ${size} | 成功: ${success} | 失败: ${failed}`);

      if (i < articles.length - 1) {
        const delay = this.getRandomDelay(delayMin, delayMax);
        this.logger.debug(`等待 ${delay / 1000}秒后继续...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log('');
    const phaseDuration = Math.round((Date.now() - phaseStartTime) / 1000);
    const successRate = (success / articles.length * 100).toFixed(2);
    const threshold = CONFIG.successThreshold[testType] || 90;
    const status = successRate >= threshold ? '🟢 通过' : successRate >= threshold - 10 ? '🟡 警告' : '🔴 危险';

    console.log(`\n${'─'.repeat(65)}`);
    console.log(`📊 ${phase.name} 测试完成`);
    console.log(`${'─'.repeat(65)}`);
    this.logger.success(`测试耗时: ${phaseDuration}秒`);
    this.logger.info(`成功: ${success}/${articles.length} | 失败: ${failed}`);
    this.logger.info(`成功率: ${successRate}% | 阈值: ${threshold}% | 状态: ${status}`);

    if (failed > 0) {
      this.logger.warn(`错误统计:`);
      const errorCounts = {};
      this.metrics.errors.slice(-articles.length).forEach(e => {
        const type = e.errorType || '未知错误';
        errorCounts[type] = (errorCounts[type] || 0) + 1;
      });
      Object.entries(errorCounts).forEach(([type, count]) => {
        console.log(`    - ${type}: ${count}次`);
      });
    }

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
      duration: phaseDuration,
      errors: this.metrics.errors.slice(-10)
    };
  }

  async runTest(testType, specificDay = null) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║       方案B - 9天渐进式压力测试                          ║
╚══════════════════════════════════════════════════════════════╝
    `);

    this.logger.info('='.repeat(50));
    this.logger.info('测试脚本启动');
    this.logger.info('='.repeat(50));

    const dbStatus = await this.checkDatabaseConnection();
    if (!dbStatus) {
      this.logger.error('数据库连接失败，测试无法继续');
      return;
    }

    let testConfig;
    if (testType === 'article-count') {
      testConfig = CONFIG.test.articleCount;
    } else if (testType === 'account-count') {
      testConfig = CONFIG.test.accountCount;
    } else if (testType === 'interval') {
      testConfig = CONFIG.test.interval;
    } else {
      this.logger.error(`未知的测试类型: ${testType}`);
      return;
    }

    console.log(`\n测试类型: ${testConfig.name}`);
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

    this.logger.info(`将执行 ${phases.length} 个阶段的测试`);

    const results = [];

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      this.logger.info(`\n${'─'.repeat(50)}`);
      this.logger.info(`开始第 ${i + 1}/${phases.length} 个阶段: ${phase.name}`);
      this.logger.info(`${'─'.repeat(50)}`);

      const result = await this.runPhase(phase, testType);
      if (result) {
        results.push(result);
        this.metrics.phaseResults.push(result);
      }

      if (!this.shouldStop && i < phases.length - 1) {
        console.log(`\n${'─'.repeat(50)}`);
        this.logger.info(`阶段 ${phase.name} 完成，休息2分钟后继续下一阶段...`);
        console.log(`${'─'.repeat(50)}\n`);
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

    this.logger.info('开始9天完整测试流程');
    this.testResults = {};

    console.log('\n' + '='.repeat(65));
    console.log('第一阶段: Day 1-3 文章数量测试');
    console.log('='.repeat(65) + '\n');
    this.testResults['article-count'] = await this.runTest('article-count');

    console.log('\n' + '='.repeat(65));
    console.log('第二阶段: Day 4-6 公众号数量测试');
    console.log('='.repeat(65) + '\n');
    this.testResults['account-count'] = await this.runTest('account-count');

    console.log('\n' + '='.repeat(65));
    console.log('第三阶段: Day 7-9 间隔时间测试');
    console.log('='.repeat(65) + '\n');
    this.testResults['interval'] = await this.runTest('interval');

    this.generateFinalReport();
  }

  saveReport(results, testType, specificDay) {
    this.logger.info('正在生成测试报告...');

    const reportDir = path.join(__dirname, 'data', '9day-pressure-test');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
      this.logger.debug(`创建报告目录: ${reportDir}`);
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

    this.logger.success(`报告已保存:`);
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
    this.logger.success(`最终报告已保存: ${finalReportFile}`);
  }

  printSummary(results, testName) {
    console.log(`
${'═'.repeat(65)}
📋 测试阶段汇总: ${testName}
${'═'.repeat(65)}
`);

    results.forEach(r => {
      const statusIcon = r.status === 'pass' ? '🟢' : r.status === 'warning' ? '🟡' : '🔴';
      console.log(`  ${r.phase}: 成功 ${r.success}/${r.total} (${r.successRate}%) ${statusIcon} | 耗时: ${r.duration}秒`);
    });

    const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalArticles = results.reduce((sum, r) => sum + r.total, 0);
    const overallRate = ((totalSuccess / totalArticles) * 100).toFixed(2);

    console.log(`
${'─'.repeat(65)}
总计: 成功 ${totalSuccess} | 失败 ${totalFailed} | 成功率 ${overallRate}%
${'─'.repeat(65)}
`);
  }
}

const main = async () => {
  const args = process.argv.slice(2);
  const test = new PressureTest9Day();

  const testArg = args.find(arg => arg.startsWith('--test='));
  const dayArg = args.find(arg => arg.startsWith('--day='));
  const runAllArg = args.includes('--run-all');

  if (runAllArg) {
    console.log('启动9天完整测试流程...\n');
    await test.runAllTests();
  } else if (testArg && dayArg) {
    const testType = testArg.replace('--test=', '');
    const day = parseInt(dayArg.replace('--day=', ''));
    console.log(`启动单项测试: ${testType} Day ${day}\n`);
    await test.runTest(testType, day);
  } else if (testArg) {
    const testType = testArg.replace('--test=', '');
    console.log(`启动测试类型: ${testType} (全部天数)\n`);
    await test.runTest(testType);
  } else {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║       方案B - 9天压力测试脚本                             ║
║                                                              ║
║  使用方式:                                                   ║
║    --test=<type>       测试类型 (article-count/account-count/interval)  ║
║    --day=N             指定第N天测试                              ║
║    --run-all           运行全部9天测试                           ║
║                                                              ║
║  示例:                                                       ║
║    node test/pressure-test-9day.js --test=article-count        ║
║    node test/pressure-test-9day.js --test=account-count --day=4 ║
║    node test/pressure-test-9day.js --run-all                   ║
╚══════════════════════════════════════════════════════════════╝
    `);
  }
};

main().catch(console.error);