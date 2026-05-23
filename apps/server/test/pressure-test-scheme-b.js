/**
 * 方案B保守版压力测试脚本
 *
 * 测试目标：50-80篇/天（保守策略）
 * 测试周期：3天快速验证
 *
 * 使用方式：
 *   node test/pressure-test-scheme-b.js --phase=1
 *   node test/pressure-test-scheme-b.js --phase=2
 *   node test/pressure-test-scheme-b.js --phase=3
 */

const got = require('got');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  // 方案B保守配置
  PHASE_1: {
    name: '基线测试',
    description: '验证基础抓取能力',
    feedsPerBatch: 3,
    articlesPerFeed: 5,
    minDelayMs: 30000,
    maxDelayMs: 60000,
    batchIntervalMs: 300000,
    dailyArticleLimit: 30,
    expectedSuccessRate: 0.98,
  },
  PHASE_2: {
    name: '小幅加压',
    description: '提升到正常水平',
    feedsPerBatch: 5,
    articlesPerFeed: 8,
    minDelayMs: 20000,
    maxDelayMs: 45000,
    batchIntervalMs: 240000,
    dailyArticleLimit: 60,
    expectedSuccessRate: 0.95,
  },
  PHASE_3: {
    name: '确定上限',
    description: '找到安全边界',
    feedsPerBatch: 8,
    articlesPerFeed: 10,
    minDelayMs: 15000,
    maxDelayMs: 30000,
    batchIntervalMs: 180000,
    dailyArticleLimit: 80,
    expectedSuccessRate: 0.90,
  },
};

const REPORT_DIR = path.join(__dirname, 'data', 'daily-reports');

class SchemeBPressureTest {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
    ];

    this.metrics = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      totalArticles: 0,
      successArticles: 0,
      failedArticles: 0,
      errors: [],
      responseTimes: [],
      startTime: null,
      endTime: null,
      alerts: [],
    };
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
  }

  async getDatabaseArticles(limit) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      datasources: { db: { url: 'file:../data/wewe-rss.db' } }
    });

    const articles = await prisma.article.findMany({
      take: limit,
      orderBy: { publishTime: 'desc' },
      select: { id: true, title: true, mpId: true }
    });

    await prisma.$disconnect();
    return articles;
  }

  async getFeedsForTest(count) {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      datasources: { db: { url: 'file:../data/wewe-rss.db' } }
    });

    const feeds = await prisma.feed.findMany({
      where: { status: 1 },
      take: count,
      select: { id: true, mpName: true }
    });

    await prisma.$disconnect();
    return feeds;
  }

  async fetchArticleContent(articleId) {
    const articleUrl = `https://mp.weixin.qq.com/s/${articleId}`;
    const startTime = Date.now();

    try {
      const response = await got(articleUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        },
        timeout: 30000,
      });

      const responseTime = Date.now() - startTime;
      const $ = cheerio.load(response.body);

      const title = $('#activity-name').text().trim() || '无标题';
      const author = $('#js_name').text().trim() || '未知作者';
      const content = $('.rich_media_content').html() || '';
      const contentText = $('.rich_media_content').text().trim();

      return {
        success: true,
        articleId,
        title,
        author,
        content,
        contentLength: content.length,
        contentTextLength: contentText.length,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorType = 'unknown';
      let errorMsg = error.message;

      if (error.response?.statusCode === 403) {
        errorType = 'forbidden';
        errorMsg = '403 - 可能被封号';
      } else if (error.response?.statusCode === 429) {
        errorType = 'rateLimit';
        errorMsg = '429 - 请求过于频繁';
      } else if (error.name === 'TimeoutError') {
        errorType = 'timeout';
      }

      return {
        success: false,
        articleId,
        title: null,
        author: null,
        content: null,
        contentLength: 0,
        responseTime,
        errorType,
        errorMsg,
      };
    }
  }

  async runPhase(phase) {
    const config = CONFIG[`PHASE_${phase}`];
    if (!config) {
      console.error(`无效的阶段: ${phase}`);
      return;
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`  方案B保守版压力测试 - ${config.name}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`\n配置信息:`);
    console.log(`  - 公众号/批次: ${config.feedsPerBatch}`);
    console.log(`  - 文章/公众号: ${config.articlesPerFeed}`);
    console.log(`  - 抓取间隔: ${config.minDelayMs/1000}-${config.maxDelayMs/1000}秒`);
    console.log(`  - 批次间隔: ${config.batchIntervalMs/1000}秒`);
    console.log(`  - 每日文章上限: ${config.dailyArticleLimit}`);
    console.log(`  - 期望成功率: ${(config.expectedSuccessRate * 100).toFixed(0)}%\n`);

    this.metrics.startTime = Date.now();
    this.metrics.totalRequests = 0;
    this.metrics.successRequests = 0;
    this.metrics.failedRequests = 0;

    const articles = await this.getDatabaseArticles(config.dailyArticleLimit);
    if (articles.length === 0) {
      console.log('❌ 数据库中没有文章');
      return;
    }

    console.log(`📋 从数据库获取 ${articles.length} 篇文章\n`);
    let processedCount = 0;

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const isLast = i === articles.length - 1;

      process.stdout.write(`  [${i + 1}/${articles.length}] 抓取文章 ${article.id.slice(0, 12)}... `);

      const result = await this.fetchArticleContent(article.id);
      this.metrics.totalRequests++;
      this.metrics.totalArticles++;

      if (result.success) {
        this.metrics.successRequests++;
        this.metrics.successArticles++;
        this.metrics.responseTimes.push(result.responseTime);
        process.stdout.write(`✅ ${result.responseTime}ms | ${(result.contentLength / 1024).toFixed(1)}KB\n`);
      } else {
        this.metrics.failedRequests++;
        this.metrics.failedArticles++;
        this.metrics.errors.push({
          articleId: article.id,
          type: result.errorType,
          message: result.errorMsg,
          time: new Date().toISOString(),
        });
        process.stdout.write(`❌ ${result.errorType}\n`);

        if (result.errorType === 'forbidden') {
          this.metrics.alerts.push({
            level: 'critical',
            message: `检测到403错误，可能被封号`,
            time: new Date().toISOString(),
          });
        }
      }

      if (!isLast) {
        const delay = this.getRandomDelay(config.minDelayMs, config.maxDelayMs);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      processedCount++;
      const progress = Math.round((processedCount / config.dailyArticleLimit) * 100);
      process.stdout.write(`\r  进度: ${progress}% (${processedCount}/${config.dailyArticleLimit})`);
    }

    this.metrics.endTime = Date.now();

    const report = this.generateReport(config);
    this.saveReport(report, phase);
    this.printSummary(config);

    return report;
  }

  generateReport(config) {
    const duration = this.metrics.endTime - this.metrics.startTime;
    const successRate = this.metrics.totalRequests > 0
      ? this.metrics.successRequests / this.metrics.totalRequests
      : 0;

    const avgResponseTime = this.metrics.responseTimes.length > 0
      ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
      : 0;

    const status = this.getStatus(successRate);

    return {
      date: new Date().toISOString().split('T')[0],
      phase: config.name,
      config: {
        feedsPerBatch: config.feedsPerBatch,
        articlesPerFeed: config.articlesPerFeed,
        delayRange: `${config.minDelayMs/1000}-${config.maxDelayMs/1000}秒`,
        batchInterval: `${config.batchIntervalMs/1000}秒`,
        dailyLimit: config.dailyArticleLimit,
      },
      metrics: {
        totalRequests: this.metrics.totalRequests,
        successRequests: this.metrics.successRequests,
        failedRequests: this.metrics.failedRequests,
        successRate: (successRate * 100).toFixed(2) + '%',
        avgResponseTime: Math.round(avgResponseTime) + 'ms',
        totalDuration: Math.round(duration / 1000) + '秒',
      },
      errors: this.metrics.errors.slice(0, 10),
      alerts: this.metrics.alerts,
      status,
    };
  }

  getStatus(successRate) {
    if (successRate >= 0.95) return { level: '🟢 正常', action: '可继续加压测试' };
    if (successRate >= 0.85) return { level: '🟡 警告', action: '保持当前配置观察' };
    if (successRate >= 0.60) return { level: '🟠 危险', action: '降低负载20%' };
    return { level: '🔴 封号', action: '立即停止测试' };
  }

  saveReport(report, phase) {
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    const filename = `${report.date}-phase${phase}-report.json`;
    const filepath = path.join(REPORT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\n💾 JSON报告已保存: ${filepath}`);

    const mdContent = this.generateMarkdown(report);
    const mdFilename = `${report.date}-phase${phase}-report.md`;
    const mdFilepath = path.join(REPORT_DIR, mdFilename);
    fs.writeFileSync(mdFilepath, mdContent);
    console.log(`📝 Markdown报告已保存: ${mdFilepath}`);

    const indexPath = path.join(REPORT_DIR, 'README.md');
    this.updateIndex(indexPath, report, mdFilename);
  }

  generateMarkdown(report) {
    const errorTable = report.errors.length > 0
      ? report.errors.map(e => `| ${e.articleId.slice(0, 12)} | ${e.type} | ${e.message} |`).join('\n')
      : '| - | - | - |';

    return `# 📊 方案B压力测试日报 - ${report.date}

## 测试阶段
**${report.phase}**

## 📋 测试配置
| 参数 | 值 |
|------|-----|
| 公众号/批次 | ${report.config.feedsPerBatch} |
| 文章/公众号 | ${report.config.articlesPerFeed} |
| 抓取间隔 | ${report.config.delayRange} |
| 批次间隔 | ${report.config.batchInterval} |
| 每日文章上限 | ${report.config.dailyLimit} |

## 📈 测试结果

### 数量统计
| 指标 | 数值 |
|------|------|
| 总请求数 | ${report.metrics.totalRequests} |
| 成功 | ${report.metrics.successRequests} |
| 失败 | ${report.metrics.failedRequests} |
| **成功率** | **${report.metrics.successRate}** |
| 平均响应时间 | ${report.metrics.avgResponseTime} |
| 总耗时 | ${report.metrics.totalDuration} |

### 状态评估
| 项目 | 结果 |
|------|------|
| 当前状态 | **${report.status.level}** |
| 建议操作 | ${report.status.action} |

## ❌ 错误详情

| 文章ID | 错误类型 | 错误信息 |
|--------|---------|---------|
${errorTable}

## 🚨 告警记录

${report.alerts.length > 0
  ? report.alerts.map(a => `- **${a.level}**: ${a.message} (${a.time})`).join('\n')
  : '无告警记录'}

---

*报告生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*
`;
  }

  updateIndex(indexPath, report, mdFilename) {
    let indexContent = '';

    if (fs.existsSync(indexPath)) {
      indexContent = fs.readFileSync(indexPath, 'utf-8');
    } else {
      indexContent = `# 📊 方案B压力测试报告\n\n---\n\n`;
    }

    const entry = `- **${report.date}** - ${report.phase}: ${report.metrics.successRate} [详细报告](./${mdFilename})`;

    if (!indexContent.includes(report.date)) {
      indexContent = indexContent.replace(
        /(## 测试报告\n\n)/,
        `$1${entry}\n`
      );
      fs.writeFileSync(indexPath, indexContent);
      console.log(`📑 索引已更新: ${indexPath}`);
    }
  }

  printSummary(config) {
    const successRate = this.metrics.successRequests / this.metrics.totalRequests;

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`                    测试完成 - 结果汇总`);
    console.log(`${'─'.repeat(70)}`);
    console.log(`\n📈 统计:`);
    console.log(`  - 总请求: ${this.metrics.totalRequests}`);
    console.log(`  - 成功: ${this.metrics.successRequests} | 失败: ${this.metrics.failedRequests}`);
    console.log(`  - 成功率: ${(successRate * 100).toFixed(1)}%`);
    console.log(`\n🛡️ 状态: ${this.getStatus(successRate).level}`);
    console.log(`💡 建议: ${this.getStatus(successRate).action}`);
    console.log(`\n${'─'.repeat(70)}\n`);
  }
}

const args = process.argv.slice(2);
const phaseArg = args.find(arg => arg.startsWith('--phase='));
const phase = phaseArg ? parseInt(phaseArg.split('=')[1]) : 1;

const test = new SchemeBPressureTest();
test.runPhase(phase).catch(console.error);
