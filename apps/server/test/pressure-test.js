/**
 * 爬虫抓取上限压力测试脚本
 *
 * 使用方式:
 *   node test/pressure-test.js --phase=1 --day=1
 *   node test/pressure-test.js --phase=2 --day=3
 *   node test/pressure-test.js --realtime
 *
 * 功能:
 *   - 执行各阶段的抓取压力测试
 *   - 实时监控成功率、响应时间、错误分布
 *   - 自动触发告警和降级
 */

const got = require('got');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// 测试配置（14天7个阶段）
const PHASE_CONFIGS = {
  1: {
    name: '基线测试',
    description: 'Day 1-2: 验证当前配置稳定性',
    maxFeedsPerBatch: 3,
    maxArticlesPerFeed: 5,
    minDelaySeconds: 30,
    maxDelaySeconds: 120,
    batchIntervalSeconds: 300,
    dailyBudget: 50,
    expectedSuccessRate: 0.98,
  },
  2: {
    name: '小幅加压',
    description: 'Day 3-4: 小幅增加负载',
    maxFeedsPerBatch: 5,
    maxArticlesPerFeed: 8,
    minDelaySeconds: 20,
    maxDelaySeconds: 90,
    batchIntervalSeconds: 240,
    dailyBudget: 80,
    expectedSuccessRate: 0.95,
  },
  3: {
    name: '接近上限',
    description: 'Day 5-6: 接近理论上限',
    maxFeedsPerBatch: 8,
    maxArticlesPerFeed: 10,
    minDelaySeconds: 15,
    maxDelaySeconds: 60,
    batchIntervalSeconds: 180,
    dailyBudget: 100,
    expectedSuccessRate: 0.90,
  },
  4: {
    name: '极限试探',
    description: 'Day 7: 触发边界，观察告警',
    maxFeedsPerBatch: 10,
    maxArticlesPerFeed: 12,
    minDelaySeconds: 10,
    maxDelaySeconds: 45,
    batchIntervalSeconds: 120,
    dailyBudget: 120,
    expectedSuccessRate: 0.85,
  },
  5: {
    name: '安全配置验证',
    description: 'Day 8-9: 验证安全配置',
    maxFeedsPerBatch: 8,
    maxArticlesPerFeed: 10,
    minDelaySeconds: 15,
    maxDelaySeconds: 60,
    batchIntervalSeconds: 180,
    dailyBudget: 100,
    expectedSuccessRate: 0.95,
  },
  6: {
    name: '配置微调',
    description: 'Day 10-11: 寻找最佳平衡',
    maxFeedsPerBatch: 8,
    maxArticlesPerFeed: 12,
    minDelaySeconds: 15,
    maxDelaySeconds: 45,
    batchIntervalSeconds: 150,
    dailyBudget: 110,
    expectedSuccessRate: 0.93,
  },
  7: {
    name: '最终验证',
    description: 'Day 12-13: 确认最终推荐配置',
    maxFeedsPerBatch: 10,
    maxArticlesPerFeed: 10,
    minDelaySeconds: 15,
    maxDelaySeconds: 45,
    batchIntervalSeconds: 120,
    dailyBudget: 120,
    expectedSuccessRate: 0.92,
  },
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

class PressureTestRunner {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      errorDistribution: {
        timeout: 0,
        networkError: 0,
        forbidden: 0,
        rateLimit: 0,
        serverError: 0,
        other: 0,
      },
      responseTimes: [],
      alerts: [],
      startTime: null,
      config: null,
    };

    this.dataDir = path.join(__dirname, 'data', 'pressure-test');
    this.ensureDataDir();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  getRandomDelay(config) {
    return Math.floor(
      Math.random() * (config.maxDelaySeconds - config.minDelaySeconds) +
        config.minDelaySeconds
    ) * 1000;
  }

  async fetchArticle(articleId, config) {
    const articleUrl = `https://mp.weixin.qq.com/s/${articleId}`;
    const startTime = Date.now();

    try {
      const response = await got(articleUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Connection': 'keep-alive',
        },
        timeout: {
          request: 30000,
        },
        retry: {
          limit: 2,
          methods: ['GET'],
          statusCodes: [408, 413, 429, 500, 502, 503, 504],
        },
      });

      const responseTime = Date.now() - startTime;
      const statusCode = response.statusCode;

      if (statusCode === 200) {
        const $ = cheerio.load(response.body);
        const title = $('#activity-name').text().trim() || '无标题';
        const content = $('.rich_media_content').html() || '';

        return {
          success: true,
          articleId,
          title,
          contentLength: content.length,
          responseTime,
          statusCode,
        };
      } else if (statusCode === 403) {
        return {
          success: false,
          articleId,
          responseTime,
          statusCode,
          errorType: 'forbidden',
          errorMessage: '403 Forbidden - 可能被封号或IP被限制',
        };
      } else if (statusCode === 429) {
        return {
          success: false,
          articleId,
          responseTime,
          statusCode,
          errorType: 'rateLimit',
          errorMessage: '429 Rate Limit - 请求过于频繁',
        };
      } else {
        return {
          success: false,
          articleId,
          responseTime,
          statusCode,
          errorType: 'serverError',
          errorMessage: `服务器返回错误: ${statusCode}`,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorType = 'other';
      let errorMessage = error.message;

      if (error.name === 'TimeoutError') {
        errorType = 'timeout';
        errorMessage = '请求超时';
      } else if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
        errorType = 'networkError';
        errorMessage = `网络错误: ${error.code}`;
      } else if (error.response && error.response.statusCode === 403) {
        errorType = 'forbidden';
        errorMessage = '403 Forbidden - 可能被封号或IP被限制';
      } else if (error.response && error.response.statusCode === 429) {
        errorType = 'rateLimit';
        errorMessage = '429 Rate Limit - 请求过于频繁';
      }

      return {
        success: false,
        articleId,
        responseTime,
        statusCode: error.response?.statusCode || 0,
        errorType,
        errorMessage,
      };
    }
  }

  updateMetrics(result) {
    this.metrics.totalRequests++;
    this.metrics.responseTimes.push(result.responseTime);

    if (result.success) {
      this.metrics.successRequests++;
    } else {
      this.metrics.failedRequests++;
      if (result.errorType && this.metrics.errorDistribution[result.errorType] !== undefined) {
        this.metrics.errorDistribution[result.errorType]++;
      }
    }
  }

  getSuccessRate() {
    if (this.metrics.totalRequests === 0) return 0;
    return this.metrics.successRequests / this.metrics.totalRequests;
  }

  getAvgResponseTime() {
    if (this.metrics.responseTimes.length === 0) return 0;
    const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.metrics.responseTimes.length);
  }

  checkAlert(config) {
    const successRate = this.getSuccessRate();
    const alerts = [];

    if (successRate < 0.60) {
      alerts.push({
        level: 'critical',
        message: '🔴 封号警告: 成功率低于60%，立即停止测试',
        timestamp: new Date().toISOString(),
      });
    } else if (successRate < 0.85) {
      alerts.push({
        level: 'danger',
        message: '🟠 危险: 成功率低于85%，建议降低50%负载',
        timestamp: new Date().toISOString(),
      });
    } else if (successRate < 0.95) {
      alerts.push({
        level: 'warning',
        message: '🟡 警告: 成功率低于95%，建议降低20%负载',
        timestamp: new Date().toISOString(),
      });
    }

    if (this.metrics.errorDistribution.forbidden >= 3) {
      alerts.push({
        level: 'critical',
        message: '🔴 封号警告: 连续3次403错误，立即停止测试',
        timestamp: new Date().toISOString(),
      });
    }

    if (this.metrics.errorDistribution.rateLimit >= 5) {
      alerts.push({
        level: 'danger',
        message: '🟠 限流警告: 5次429错误，请求频率过高',
        timestamp: new Date().toISOString(),
      });
    }

    this.metrics.alerts.push(...alerts);
    return alerts;
  }

  printProgress(phase, day, progress) {
    const successRate = this.getSuccessRate();
    const avgResponseTime = this.getAvgResponseTime();
    const config = PHASE_CONFIGS[phase];

    let status = '🟢 正常';
    if (successRate < 0.60) status = '🔴 封号';
    else if (successRate < 0.85) status = '🟠 危险';
    else if (successRate < 0.95) status = '🟡 警告';

    console.clear();
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log(`║           爬虫压力测试 - Day ${day} (Phase ${phase}: ${config.name})`.padEnd(66) + '║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log(`║  配置: 公众号${config.maxFeedsPerBatch}个/批 | 文章${config.maxArticlesPerFeed}篇/公众号 | 延迟${config.minDelaySeconds}-${config.maxDelaySeconds}秒`.padEnd(68) + '║');
    console.log(`║  进度: ${this.getProgressBar(progress)} ${progress}% (${this.metrics.totalRequests}/${config.dailyBudget})`.padEnd(68) + '║');
    console.log(`║  成功: ${this.metrics.successRequests} | 失败: ${this.metrics.failedRequests} | 成功率: ${(successRate * 100).toFixed(1)}%`.padEnd(68) + '║');
    console.log(`║  平均响应: ${avgResponseTime}ms | 状态: ${status}`.padEnd(68) + '║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    if (this.metrics.alerts.length > 0) {
      const latestAlert = this.metrics.alerts[this.metrics.alerts.length - 1];
      console.log(`\n${latestAlert.message}`);
    }
  }

  getProgressBar(progress) {
    const width = 30;
    const filled = Math.round(width * progress / 100);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  saveDailyReport(phase, day) {
    const config = PHASE_CONFIGS[phase];
    const report = {
      date: new Date().toISOString().split('T')[0],
      phase,
      day,
      config: { ...config },
      metrics: {
        ...this.metrics,
        successRate: this.getSuccessRate(),
        avgResponseTime: this.getAvgResponseTime(),
        minResponseTime: Math.min(...this.metrics.responseTimes),
        maxResponseTime: Math.max(...this.metrics.responseTimes),
      },
      status: this.getSuccessRate() >= 0.95 ? '正常' : this.getSuccessRate() >= 0.85 ? '警告' : '危险',
    };

    const filename = path.join(
      this.dataDir,
      `report-phase${phase}-day${day}-${report.date}.json`
    );
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`\n📄 报告已保存: ${filename}`);

    return report;
  }

  async runPhase(phase, day) {
    const config = PHASE_CONFIGS[phase];
    if (!config) {
      console.error(`❌ 无效的阶段: ${phase}`);
      return;
    }

    console.log(`\n🚀 开始阶段 ${phase}: ${config.name}`);
    console.log(`📝 ${config.description}`);
    console.log(`⚙️  配置: ${JSON.stringify(config, null, 2)}\n`);

    this.metrics = {
      totalRequests: 0,
      successRequests: 0,
      failedRequests: 0,
      errorDistribution: {
        timeout: 0,
        networkError: 0,
        forbidden: 0,
        rateLimit: 0,
        serverError: 0,
        other: 0,
      },
      responseTimes: [],
      alerts: [],
      startTime: Date.now(),
      config: { ...config },
    };

    const testArticleIds = this.getTestArticleIds(config.maxFeedsPerBatch * config.maxArticlesPerFeed);
    let requestCount = 0;

    while (requestCount < config.dailyBudget) {
      for (let i = 0; i < testArticleIds.length && requestCount < config.dailyBudget; i++) {
        const result = await this.fetchArticle(testArticleIds[i], config);
        this.updateMetrics(result);
        requestCount++;

        const progress = Math.round((requestCount / config.dailyBudget) * 100);
        this.printProgress(phase, day, progress);

        const alerts = this.checkAlert(config);
        if (alerts.some(a => a.level === 'critical')) {
          console.log('\n⛔ 检测到严重告警，自动停止测试');
          this.saveDailyReport(phase, day);
          return { stopped: true, reason: 'critical_alert' };
        }

        if (requestCount < config.dailyBudget) {
          const delay = this.getRandomDelay(config);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (requestCount < config.dailyBudget) {
        console.log(`\n📦 完成一批次，等待 ${config.batchIntervalSeconds} 秒...`);
        await new Promise(resolve => setTimeout(resolve, config.batchIntervalSeconds * 1000));
      }
    }

    const report = this.saveDailyReport(phase, day);
    console.log('\n✅ 阶段测试完成');
    console.log(`📊 最终成功率: ${(this.getSuccessRate() * 100).toFixed(1)}%`);
    console.log(`📊 平均响应时间: ${this.getAvgResponseTime()}ms`);

    return report;
  }

  getTestArticleIds(count) {
    const testIds = [
      'test_article_001', 'test_article_002', 'test_article_003',
      'test_article_004', 'test_article_005', 'test_article_006',
      'test_article_007', 'test_article_008', 'test_article_009',
      'test_article_010', 'test_article_011', 'test_article_012',
      'test_article_013', 'test_article_014', 'test_article_015',
      'test_article_016', 'test_article_017', 'test_article_018',
      'test_article_019', 'test_article_020', 'test_article_021',
      'test_article_022', 'test_article_023', 'test_article_024',
      'test_article_025', 'test_article_026', 'test_article_027',
      'test_article_028', 'test_article_029', 'test_article_030',
    ];

    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(testIds[i % testIds.length]);
    }
    return result;
  }

  async runRealtime() {
    console.log('\n🔄 实时监控模式启动 (Ctrl+C 退出)');
    console.log('等待测试数据...\n');

    setInterval(() => {
      const files = fs.readdirSync(this.dataDir)
        .filter(f => f.startsWith('report-phase') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 1);

      if (files.length > 0) {
        const latestReport = JSON.parse(
          fs.readFileSync(path.join(this.dataDir, files[0]), 'utf8')
        );

        console.clear();
        console.log('╔══════════════════════════════════════════════════════════════════╗');
        console.log(`║           实时监控 - ${new Date().toLocaleString()}`.padEnd(66) + '║');
        console.log('╠══════════════════════════════════════════════════════════════════╣');
        console.log(`║  最新报告: ${files[0]}`.padEnd(68) + '║');
        console.log(`║  阶段: Phase ${latestReport.phase} (${PHASE_CONFIGS[latestReport.phase]?.name})`.padEnd(68) + '║');
        console.log(`║  成功率: ${(latestReport.metrics.successRate * 100).toFixed(1)}%`.padEnd(68) + '║');
        console.log(`║  总请求: ${latestReport.metrics.totalRequests} | 成功: ${latestReport.metrics.successRequests} | 失败: ${latestReport.metrics.failedRequests}`.padEnd(68) + '║');
        console.log(`║  平均响应: ${latestReport.metrics.avgResponseTime}ms`.padEnd(68) + '║');
        console.log(`║  状态: ${latestReport.status}`.padEnd(68) + '║');
        console.log('╚══════════════════════════════════════════════════════════════════╝');

        if (latestReport.metrics.alerts && latestReport.metrics.alerts.length > 0) {
          console.log('\n📢 最近告警:');
          latestReport.metrics.alerts.slice(-3).forEach(alert => {
            console.log(`  ${alert.level.toUpperCase()}: ${alert.message}`);
          });
        }
      }
    }, 5000);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const runner = new PressureTestRunner();

  if (args.includes('--realtime')) {
    await runner.runRealtime();
    return;
  }

  let phase = 1;
  let day = 1;

  for (const arg of args) {
    if (arg.startsWith('--phase=')) {
      phase = parseInt(arg.split('=')[1]);
    }
    if (arg.startsWith('--day=')) {
      day = parseInt(arg.split('=')[1]);
    }
  }

  await runner.runPhase(phase, day);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PressureTestRunner, PHASE_CONFIGS };
