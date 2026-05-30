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

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min) + min) * 1000;
}

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
    const responseTime = Date.now() - startTime;

    return {
      success: true,
      available: content.length >= MIN_CONTENT_LENGTH,
      contentLength: content.length,
      responseTime,
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

async function runDay7Test() {
  console.log('========================================');
  console.log('📊 Day 7 测试 - 长间隔测试');
  console.log('========================================');
  console.log('配置: 8公众号 x 10文章/公众号 = 80文章');
  console.log('延迟: 45-90秒 (长间隔)');
  console.log('批次间隔: 120秒\n');

  const feeds = await prisma.feed.findMany({
    take: 8,
    select: { id: true, mpName: true }
  });

  console.log(`📡 找到 ${feeds.length} 个订阅源\n`);

  const metrics = {
    total: 0,
    success: 0,
    unavailable: 0,
    failed: 0,
    startTime: Date.now(),
    feedResults: []
  };

  for (let i = 0; i < feeds.length; i++) {
    const feed = feeds[i];
    console.log(`\n📱 [${i + 1}/8] ${feed.mpName}`);
    console.log('----------------------------------------');

    const articles = await prisma.article.findMany({
      where: { mpId: feed.id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true }
    });

    console.log(`   找到 ${articles.length} 篇文章\n`);

    const feedMetrics = {
      name: feed.mpName,
      total: articles.length,
      success: 0,
      unavailable: 0,
      failed: 0
    };

    for (let j = 0; j < articles.length; j++) {
      const article = articles[j];
      const url = `https://mp.weixin.qq.com/s/${article.id}`;
      feedMetrics.total++;
      metrics.total++;

      process.stdout.write(`   [${j + 1}/${articles.length}] ${article.title?.substring(0, 20) || '(无标题)'}... `);

      const result = await fetchArticle(url);

      if (result.success) {
        if (result.available) {
          metrics.success++;
          feedMetrics.success++;
          const sizeKB = (result.contentLength / 1024).toFixed(1);
          console.log(`✅ ${result.responseTime}ms | ${sizeKB}KB`);
        } else {
          metrics.unavailable++;
          feedMetrics.unavailable++;
          console.log(`🔴 内容不可用 | ${result.contentLength}字节`);
        }
      } else {
        metrics.failed++;
        feedMetrics.failed++;
        console.log(`❌ 失败 | ${result.error}`);
      }

      if (j < articles.length - 1) {
        const delay = getRandomDelay(45, 90);
        console.log(`   ⏳ 等待 ${delay / 1000}秒...\n`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    metrics.feedResults.push(feedMetrics);

    if (i < feeds.length - 1) {
      console.log('\n   ⏳ 批次间隔 120秒...\n');
      await new Promise(r => setTimeout(r, 120000));
    }
  }

  metrics.endTime = Date.now();
  const duration = Math.round((metrics.endTime - metrics.startTime) / 1000);

  console.log('\n========================================');
  console.log('📊 Day 7 测试结果汇总');
  console.log('========================================');
  console.log(`  ✅ 成功抓取: ${metrics.success}`);
  console.log(`  🔴 内容不可用: ${metrics.unavailable}`);
  console.log(`  ❌ 请求失败: ${metrics.failed}`);
  console.log(`  ─────────────────`);
  console.log(`  📈 总计: ${metrics.total}`);
  console.log(`  ⏱️  总耗时: ${duration}秒 (约${Math.round(duration / 60)}分钟)`);
  console.log(`  📊 成功率: ${metrics.total > 0 ? ((metrics.success / metrics.total) * 100).toFixed(1) : '0.0'}%`);
  console.log('========================================\n');

  console.log('📱 各公众号详细结果:');
  console.log('----------------------------------------');
  metrics.feedResults.forEach(f => {
    const rate = f.total > 0 ? ((f.success / f.total) * 100).toFixed(1) : '0.0';
    console.log(`  ${f.name}: ${f.success}/${f.total} 成功 (${rate}%)`);
  });
  console.log('');

  await prisma.$disconnect();
  return metrics;
}

runDay7Test()
  .then(() => {
    console.log('Day 7 测试完成');
    process.exit(0);
  })
  .catch(err => {
    console.error('Day 7 测试失败:', err);
    process.exit(1);
  });
