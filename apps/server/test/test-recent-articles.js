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

function checkContentQuality(content, url) {
  if (!content || content.length < MIN_CONTENT_LENGTH) {
    return {
      available: false,
      reason: '内容不可用',
      detail: content ? `内容过少(${content.length}字节)` : '内容为空'
    };
  }
  return { available: true, reason: null, detail: null };
}

async function fetchArticle(url, maxRetries = 2) {
  const shuffledAgents = [...USER_AGENTS].sort(() => Math.random() - 0.5);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const userAgent = shuffledAgents[attempt % shuffledAgents.length];
    const delay = getRandomDelay(2, 4);

    try {
      const startTime = Date.now();
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

      const quality = checkContentQuality(content, url);

      return {
        success: true,
        content,
        contentLength: content.length,
        responseTime,
        userAgent,
        ...quality
      };
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          content: '',
          contentLength: 0,
          responseTime: 0,
          userAgent: 'N/A',
          available: false,
          reason: '请求失败',
          detail: error.message
        };
      }

      const waitTime = delay * (attempt + 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

async function testRecentArticles() {
  console.log('========================================');
  console.log('📡 内容质量检测测试 (含不可用标记)');
  console.log('========================================\n');
  console.log(`内容最小长度阈值: ${MIN_CONTENT_LENGTH}字节\n`);

  const articles = await prisma.article.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, mpId: true }
  });

  console.log(`最近 ${articles.length} 篇文章:\n`);

  let availableCount = 0;
  let unavailableCount = 0;
  let failCount = 0;

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const url = `https://mp.weixin.qq.com/s/${article.id}`;

    console.log(`📄 [${i + 1}/${articles.length}] ${article.title || '(无标题)'}`);
    console.log(`   URL: ${url}\n`);

    const result = await fetchArticle(url);

    if (result.success) {
      if (result.available) {
        availableCount++;
        const sizeKB = (result.contentLength / 1024).toFixed(1);
        console.log(`   ✅ 内容可用 | ${result.responseTime}ms | ${sizeKB}KB`);
      } else {
        unavailableCount++;
        console.log(`   🔴 ${result.reason} | ${result.detail}`);
        console.log(`   💡 提示: 该文章可能被标记为不可用，避免重试`);
      }
    } else {
      failCount++;
      console.log(`   ❌ 请求失败 | ${result.detail}`);
    }
    console.log('');

    if (i < articles.length - 1) {
      const delay = getRandomDelay(2, 4);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.log('========================================');
  console.log('📊 测试结果汇总');
  console.log('========================================');
  console.log(`  ✅ 内容可用: ${availableCount}`);
  console.log(`  🔴 内容不可用: ${unavailableCount}`);
  console.log(`  ❌ 请求失败: ${failCount}`);
  console.log(`  ─────────────────`);
  console.log(`  总计: ${articles.length}`);
  console.log('========================================\n');

  console.log('💡 优化效果:');
  console.log(`  - 内容不可用的文章将被标记，避免重复抓取浪费资源`);
  console.log(`  - 不会再对不可用文章进行重试`);
  console.log(`  - 不可用的内容不会被缓存`);

  await prisma.$disconnect();
}

testRecentArticles().catch(console.error);