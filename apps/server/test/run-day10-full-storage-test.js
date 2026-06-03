/**
 * Day 10 测试 - 完整抓取入库验证
 * 
 * 目标：验证在指定测试条件下，能否完整抓取文章内容并正确存入数据库
 * 
 * 测试条件：
 * - 公众号数量: 8个
 * - 每公众号文章数: 10篇
 * - 请求延迟: 20-40秒
 * - 批次间隔: 60秒
 */

const { PrismaClient } = require('@prisma/client');
const got = require('got');
const cheerio = require('cheerio');

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:../data/wewe-rss.db' } }
});

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
];

const MIN_CONTENT_LENGTH = 500;
const ACCOUNT_COUNT = 8;
const ARTICLE_COUNT = 10;
const DELAY_MIN = 20;
const DELAY_MAX = 40;
const BATCH_INTERVAL = 60;

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min) + min) * 1000;
}

/**
 * 抓取文章内容
 */
async function fetchArticle(url) {
  const userAgent = getRandomUserAgent();
  const startTime = Date.now();

  try {
    const response = await got(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://mp.weixin.qq.com/',
        'Connection': 'keep-alive',
      },
      timeout: { request: 12000 },
    });

    const $ = cheerio.load(response.body);
    const content = $('.rich_media_content').html() || '';
    const title = $('#activity-name').text().trim() || '';
    const author = $('#js_name').text().trim() || '';

    return {
      success: true,
      available: content.length >= MIN_CONTENT_LENGTH,
      content,
      title,
      author,
      contentLength: content.length,
      responseTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error',
      contentLength: 0,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * 保存文章到数据库
 */
async function saveArticleToDb(articleData) {
  try {
    const url = `https://mp.weixin.qq.com/s/${articleData.id}`;
    
    // 检查是否已存在
    const existing = await prisma.article.findUnique({
      where: { id: articleData.id }
    });

    if (existing) {
      // 更新已有文章
      const updated = await prisma.article.update({
        where: { id: articleData.id },
        data: {
          content: articleData.content,
          author: articleData.author,
          qualityScore: articleData.content.length > 0 ? 1 : 0,
          updatedAt: new Date(),
        }
      });
      return { action: 'updated', success: true, id: updated.id };
    } else {
      // 创建新文章（需要先获取feed信息）
      return { action: 'skipped', reason: 'article not found in feeds', id: articleData.id };
    }
  } catch (error) {
    return { action: 'error', success: false, error: error.message };
  }
}

/**
 * 验证文章是否正确存入数据库
 */
async function verifyArticleInDb(articleId) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: articleId }
    });

    if (!article) {
      return { found: false, message: 'Article not found in database' };
    }

    if (!article.content || article.content.length === 0) {
      return { found: true, valid: false, message: 'Content is empty', contentLength: 0 };
    }

    return {
      found: true,
      valid: true,
      message: 'Content saved successfully',
      contentLength: article.content.length,
      title: article.title,
    };
  } catch (error) {
    return { found: false, error: error.message };
  }
}

/**
 * 运行 Day 10 测试
 */
async function runDay10Test() {
  console.log('========================================');
  console.log('📊 Day 10 测试 - 完整抓取入库验证');
  console.log('========================================');
  console.log(`配置: ${ACCOUNT_COUNT}公众号 x ${ARTICLE_COUNT}文章/公众号`);
  console.log(`延迟: ${DELAY_MIN}-${DELAY_MAX}秒`);
  console.log(`批次间隔: ${BATCH_INTERVAL}秒\n`);

  const metrics = {
    total: 0,
    fetched: 0,
    saved: 0,
    verified: 0,
    failed: 0,
    startTime: Date.now(),
    results: [],
  };

  // 获取订阅源
  const feeds = await prisma.feed.findMany({
    take: ACCOUNT_COUNT,
    select: { id: true, mpName: true }
  });

  console.log(`📡 找到 ${feeds.length} 个订阅源\n`);

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    console.log(`\n📱 [${i + 1}/${feeds.length}] ${feed.mpName}`);
    console.log('----------------------------------------');

    // 获取该公众号的最新文章
    const articles = await prisma.article.findMany({
      where: { mpId: feed.id },
      take: ARTICLE_COUNT,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, content: true }
    });

    console.log(`   找到 ${articles.length} 篇文章\n`);

    let feedMetrics = {
      name: feed.mpName,
      total: articles.length,
      fetched: 0,
      saved: 0,
      verified: 0,
      failed: 0,
    };

    for (let j = 0; j < articles.length; j++) {
      const article = articles[j];
      const url = `https://mp.weixin.qq.com/s/${article.id}`;
      metrics.total++;

      process.stdout.write(`   [${j + 1}/${articles.length}] ${article.title?.substring(0, 25) || '(无标题)'}... `);

      // 步骤1: 抓取内容
      const fetchResult = await fetchArticle(url);
      metrics.fetched++;
      feedMetrics.fetched++;

      if (fetchResult.success && fetchResult.available) {
        const sizeKB = (fetchResult.contentLength / 1024).toFixed(1);
        console.log(`\n      🔍 抓取成功: ${sizeKB}KB`);

        // 步骤2: 保存到数据库
        const saveResult = await saveArticleToDb({
          id: article.id,
          content: fetchResult.content,
          author: fetchResult.author,
        });

        if (saveResult.success && saveResult.action === 'updated') {
          metrics.saved++;
          feedMetrics.saved++;
          console.log(`      💾 保存成功`);

          // 步骤3: 验证入库
          const verifyResult = await verifyArticleInDb(article.id);
          if (verifyResult.valid) {
            metrics.verified++;
            feedMetrics.verified++;
            console.log(`      ✅ 验证通过: ${(verifyResult.contentLength / 1024).toFixed(1)}KB`);
          } else {
            metrics.failed++;
            feedMetrics.failed++;
            console.log(`      ❌ 验证失败: ${verifyResult.message}`);
          }
        } else {
          metrics.failed++;
          feedMetrics.failed++;
          console.log(`      ⚠️  保存跳过: ${saveResult.reason || saveResult.error}`);
        }

        metrics.results.push({
          articleId: article.id,
          title: article.title,
          fetched: true,
          saved: saveResult.action === 'updated',
          verified: verifyResult.valid || false,
          contentLength: fetchResult.contentLength,
        });

      } else if (fetchResult.success && !fetchResult.available) {
        metrics.failed++;
        feedMetrics.failed++;
        console.log(`\n      🔴 内容不可用: ${fetchResult.contentLength}字节 (< ${MIN_CONTENT_LENGTH})`);
      } else {
        metrics.failed++;
        feedMetrics.failed++;
        console.log(`\n      ❌ 抓取失败: ${fetchResult.error}`);
      }

      // 间隔延迟
      if (j < articles.length - 1) {
        const delay = getRandomDelay(DELAY_MIN, DELAY_MAX);
        process.stdout.write(`\n      ⏳ 等待 ${delay / 1000}秒...\n`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // 批次间隔
    if (i < feeds.length - 1) {
      console.log(`\n   ⏳ 批次间隔 ${BATCH_INTERVAL}秒...\n`);
      await new Promise(r => setTimeout(r, BATCH_INTERVAL * 1000));
    }

    metrics.results.push(feedMetrics);
  }

  metrics.endTime = Date.now();
  const duration = Math.round((metrics.endTime - metrics.startTime) / 1000);

  // 输出汇总
  console.log('\n========================================');
  console.log('📊 Day 10 测试结果汇总');
  console.log('========================================');
  console.log(`  📥 抓取成功: ${metrics.fetched}`);
  console.log(`  💾 保存成功: ${metrics.saved}`);
  console.log(`  ✅ 验证通过: ${metrics.verified}`);
  console.log(`  ❌ 失败: ${metrics.failed}`);
  console.log(`  ─────────────────`);
  console.log(`  📈 总计: ${metrics.total}`);
  console.log(`  ⏱️  总耗时: ${duration}秒 (约${Math.round(duration / 60)}分钟)`);
  console.log(`  📊 抓取率: ${metrics.total > 0 ? ((metrics.fetched / metrics.total) * 100).toFixed(1) : '0.0'}%`);
  console.log(`  📊 保存率: ${metrics.fetched > 0 ? ((metrics.saved / metrics.fetched) * 100).toFixed(1) : '0.0'}%`);
  console.log(`  📊 验证率: ${metrics.saved > 0 ? ((metrics.verified / metrics.saved) * 100).toFixed(1) : '0.0'}%`);
  console.log('========================================\n');

  // 各公众号详细结果
  console.log('📱 各公众号详细结果:');
  console.log('----------------------------------------');
  metrics.results.filter(r => r.name).forEach(f => {
    console.log(`  ${f.name}: ${f.verified}/${f.total} 验证通过`);
  });
  console.log('');

  // 保存测试结果
  const reportPath = `./data/9day-pressure-test/2026-06-01-day10-fulltest-report.json`;
  const fs = require('fs');
  fs.writeFileSync(reportPath, JSON.stringify(metrics, null, 2));
  console.log(`📄 测试报告已保存: ${reportPath}`);

  await prisma.$disconnect();
  return metrics;
}

// 运行测试
runDay10Test()
  .then(results => {
    console.log('\n✅ Day 10 测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });
