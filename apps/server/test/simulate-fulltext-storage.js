/**
 * 方案 B 本地测试脚本
 *
 * 测试目标：
 * 1. 验证批量抓取文章全文的可行性
 * 2. 测量存储大小增长
 * 3. 测量抓取耗时
 * 4. 评估封号风险
 *
 * 使用方式：
 *   node test/simulate-fulltext-storage.js
 */

const got = require('got');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class FullTextStorageSimulator {
  constructor() {
    this.results = [];
    this.config = {
      delayBetweenRequests: 1000,      // 请求间隔 1 秒（防封号）
      batchSize: 5,                   // 每批处理 5 篇
      batchDelayMs: 30000,            // 批次间隔 30 秒
      timeout: 30000,                 // 请求超时 30 秒
    };

    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    ];
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  getRandomDelay(min = 800, max = 1500) {
    return Math.floor(Math.random() * (max - min) + min);
  }

  async fetchArticleFullText(articleId) {
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
        timeout: this.config.timeout,
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
        url: articleUrl,
        content,
        contentLength: content.length,
        contentTextLength: contentText.length,
        responseTime,
        statusCode: response.statusCode,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorType = 'other';
      let errorMessage = error.message;

      if (error.name === 'TimeoutError') {
        errorType = 'timeout';
      } else if (error.response?.statusCode === 403) {
        errorType = 'forbidden';
        errorMessage = '403 Forbidden - 可能被封号';
      } else if (error.response?.statusCode === 429) {
        errorType = 'rateLimit';
        errorMessage = '429 Rate Limit - 请求过于频繁';
      }

      return {
        success: false,
        articleId,
        title: null,
        author: null,
        url: null,
        content: null,
        contentLength: 0,
        responseTime,
        errorType,
        errorMessage,
      };
    }
  }

  async simulateBatchFetch(articleIds) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📦 模拟批量抓取 ${articleIds.length} 篇文章`);
    console.log(`⏱️  配置：请求间隔 ${this.config.delayBetweenRequests}ms，批次大小 ${this.config.batchSize}`);
    console.log(`${'═'.repeat(70)}\n`);

    const batchResults = [];
    let totalDelay = 0;

    for (let i = 0; i < articleIds.length; i++) {
      const articleId = articleIds[i];
      const isLastInBatch = (i + 1) % this.config.batchSize === 0;
      const isLastArticle = i === articleIds.length - 1;

      process.stdout.write(`  [${i + 1}/${articleIds.length}] 抓取 ${articleId} ... `);

      const result = await this.fetchArticleFullText(articleId);
      batchResults.push(result);

      if (result.success) {
        process.stdout.write(`✅ ${result.responseTime}ms | ${(result.contentLength / 1024).toFixed(1)}KB\n`);
      } else {
        process.stdout.write(`❌ ${result.errorType}\n`);
      }

      // 请求间隔延迟
      if (!isLastArticle) {
        const delay = this.getRandomDelay();
        totalDelay += delay;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // 批次间隔延迟
      if (isLastInBatch && !isLastArticle) {
        console.log(`\n  ⏸️  批次完成，等待 ${this.config.batchDelayMs / 1000} 秒...\n`);
        totalDelay += this.config.batchDelayMs;
        await new Promise(resolve => setTimeout(resolve, this.config.batchDelayMs));
      }
    }

    return batchResults;
  }

  generateReport(results) {
    console.log(`\n\n${'█'.repeat(70)}`);
    console.log(`                 📊 方案 B 模拟测试报告`);
    console.log(`${'█'.repeat(70)}\n`);

    const successResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    // 基础统计
    console.log(`📋 基础统计\n`);
    console.log(`  总文章数: ${results.length}`);
    console.log(`  成功: ${successResults.length} | 失败: ${failedResults.length}`);
    console.log(`  成功率: ${((successResults.length / results.length) * 100).toFixed(1)}%`);

    // 耗时统计
    console.log(`\n⏱️  耗时统计\n`);
    const totalTime = results.reduce((sum, r) => sum + r.responseTime, 0);
    const avgTime = totalTime / results.length;
    const configDelay = (results.length - 1) * this.config.delayBetweenRequests;
    const batchDelays = Math.floor((results.length - 1) / this.config.batchSize) * this.config.batchDelayMs;
    const totalEstimatedTime = configDelay + batchDelays + totalTime;

    console.log(`  纯抓取耗时: ${(totalTime / 1000).toFixed(2)} 秒`);
    console.log(`  配置延迟耗时: ${(configDelay / 1000).toFixed(2)} 秒`);
    console.log(`  批次间隔耗时: ${(batchDelays / 1000).toFixed(2)} 秒`);
    console.log(`  ⭐ 预估总耗时: ${(totalEstimatedTime / 1000).toFixed(2)} 秒`);
    console.log(`  平均单篇耗时: ${avgTime.toFixed(0)} ms`);

    // 存储统计
    console.log(`\n💾 存储统计\n`);
    const totalContentSize = successResults.reduce((sum, r) => sum + r.contentLength, 0);
    const avgContentSize = successResults.length > 0 ? totalContentSize / successResults.length : 0;

    console.log(`  成功文章数: ${successResults.length}`);
    console.log(`  总内容大小: ${(totalContentSize / 1024).toFixed(2)} KB`);
    console.log(`  平均每篇: ${(avgContentSize / 1024).toFixed(2)} KB`);
    console.log(`  预估每日新增: ${(avgContentSize * 10 / 1024).toFixed(2)} KB (假设每日抓取 10 篇)`);
    console.log(`  预估每月增长: ${(avgContentSize * 300 / 1024 / 1024).toFixed(2)} MB (假设每月抓取 300 篇)`);

    // 与当前对比
    console.log(`\n📈 存储增长对比\n`);
    const currentAvgSize = 500; // 当前仅存储元数据约 500 字节
    const currentTotalSize = results.length * currentAvgSize;
    const newTotalSize = totalContentSize;

    console.log(`  当前方案（仅元数据）:`);
    console.log(`    - 单篇大小: ${currentAvgSize} 字节`);
    console.log(`    - 总大小: ${(currentTotalSize / 1024).toFixed(2)} KB`);
    console.log(`\n  方案 B（全文存储）:`);
    console.log(`    - 单篇大小: ${(avgContentSize / 1024).toFixed(2)} KB`);
    console.log(`    - 总大小: ${(newTotalSize / 1024).toFixed(2)} KB`);
    console.log(`\n  📊 增长倍数: ${(newTotalSize / currentTotalSize).toFixed(0)}x`);

    // 风险评估
    console.log(`\n🛡️  风险评估\n`);
    const errorCounts = {
      forbidden: failedResults.filter(r => r.errorType === 'forbidden').length,
      rateLimit: failedResults.filter(r => r.errorType === 'rateLimit').length,
      timeout: failedResults.filter(r => r.errorType === 'timeout').length,
      other: failedResults.filter(r => r.errorType === 'other').length,
    };

    if (errorCounts.forbidden > 0) {
      console.log(`  ⚠️  发现 ${errorCounts.forbidden} 次 403 错误，`);
      console.log(`     建议：增加请求间隔，降低抓取频率`);
    } else if (errorCounts.rateLimit > 0) {
      console.log(`  ⚠️  发现 ${errorCounts.rateLimit} 次 429 错误，`);
      console.log(`     建议：延长批次间隔，减少每日抓取量`);
    } else {
      console.log(`  ✅ 未检测到明显的封号风险`);
    }

    // 详细结果
    if (successResults.length > 0) {
      console.log(`\n📝 成功文章详情\n`);
      successResults.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.title || '无标题'}`);
        console.log(`     ID: ${r.articleId}`);
        console.log(`     作者: ${r.author}`);
        console.log(`     内容: ${(r.contentLength / 1024).toFixed(2)} KB | 纯文本: ${(r.contentTextLength / 1024).toFixed(2)} KB`);
        console.log(`     耗时: ${r.responseTime}ms\n`);
      });
    }

    if (failedResults.length > 0) {
      console.log(`\n❌ 失败文章详情\n`);
      failedResults.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.articleId}`);
        console.log(`     错误类型: ${r.errorType}`);
        console.log(`     错误信息: ${r.errorMessage}\n`);
      });
    }

    // 结论
    console.log(`${'█'.repeat(70)}`);
    console.log(`💡 结论与建议\n`);

    if (successResults.length === results.length) {
      console.log(`✅ 所有文章抓取成功，方案 B 可行！\n`);

      if (avgContentSize > 100 * 1024) {
        console.log(`📌 注意事项:`);
        console.log(`   - 文章内容较大（平均 > 100KB），存储空间增长明显`);
        console.log(`   - 建议开启 gzip 压缩存储`);
      }

      if (avgTime > 2000) {
        console.log(`📌 性能建议:`);
        console.log(`   - 平均响应时间较长（> 2s），建议增加缓存`);
      }
    } else {
      console.log(`⚠️  部分文章抓取失败，建议调整参数后重试\n`);
      console.log(`📌 建议调整:`);
      console.log(`   - 增加请求间隔（当前 ${this.config.delayBetweenRequests}ms）`);
      console.log(`   - 减少批次大小（当前 ${this.config.batchSize}）`);
      console.log(`   - 增加批次间隔（当前 ${this.config.batchDelayMs / 1000}s）`);
    }

    console.log(`${'█'.repeat(70)}\n`);

    return {
      totalArticles: results.length,
      successCount: successResults.length,
      failedCount: failedResults.length,
      totalContentSize,
      avgContentSize,
      totalTime,
      avgTime,
      estimatedTotalTime: totalEstimatedTime,
      errorCounts,
    };
  }

  async run() {
    console.log(`\n${'█'.repeat(70)}`);
    console.log(`          方案 B 本地测试 - 模拟全文存储抓取`);
    console.log(`${'█'.repeat(70)}\n`);

    // 从数据库获取文章 ID
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: 'file:../data/wewe-rss.db'
        }
      }
    });

    console.log('📋 从数据库获取文章列表...\n');

    const articles = await prisma.article.findMany({
      take: 10,
      orderBy: { publishTime: 'desc' },
      select: {
        id: true,
        title: true,
        publishTime: true,
      }
    });

    await prisma.$disconnect();

    if (articles.length === 0) {
      console.log('❌ 数据库中没有文章，请先运行抓取任务');
      return;
    }

    console.log(`获取到 ${articles.length} 篇文章:\n`);
    articles.forEach((article, index) => {
      const date = new Date(article.publishTime * 1000).toLocaleString('zh-CN');
      console.log(`  ${index + 1}. ${article.title}`);
      console.log(`     ID: ${article.id} | 时间: ${date}\n`);
    });

    // 确认测试
    console.log(`${'─'.repeat(70)}`);
    console.log(`⚠️  即将模拟抓取 ${articles.length} 篇文章的全文\n`);
    console.log(`   预估总耗时: ~${((articles.length * 2 + Math.floor(articles.length / 5) * 30) / 60).toFixed(1)} 分钟\n`);
    console.log(`${'─'.repeat(70)}\n`);

    // 运行模拟
    const startTime = Date.now();
    const results = await this.simulateBatchFetch(articles.map(a => a.id));
    const report = this.generateReport(results);

    // 保存报告
    const reportData = {
      timestamp: new Date().toISOString(),
      config: this.config,
      results,
      report,
    };

    const outputPath = path.join(__dirname, 'data', 'fulltext-storage-test.json');
    const dataDir = path.dirname(outputPath);

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
    console.log(`💾 测试报告已保存: ${outputPath}\n`);

    return report;
  }
}

// 运行测试
const simulator = new FullTextStorageSimulator();
simulator.run().catch(console.error);
