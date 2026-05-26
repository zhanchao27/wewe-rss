const { PrismaClient } = require('@prisma/client');
const got = require('got');
const cheerio = require('cheerio');

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:../data/wewe-rss.db' } }
});

async function testRandomAccounts() {
  console.log('========================================');
  console.log('📡 随机测试新增公众号抓取功能');
  console.log('========================================\n');

  const feeds = await prisma.feed.findMany({
    where: { status: 1 },
    select: { id: true, mpName: true }
  });

  console.log(`总订阅源数: ${feeds.length}`);
  console.log('随机选取3个订阅源进行抓取测试...\n');

  const shuffled = feeds.sort(() => Math.random() - 0.5).slice(0, 3);

  for (const feed of shuffled) {
    console.log('─'.repeat(50));
    console.log(`📰 订阅源: ${feed.mpName}`);
    console.log('─'.repeat(50));

    const articles = await prisma.article.findMany({
      where: { mpId: feed.id },
      take: 2,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true }
    });

    console.log(`文章数: ${articles.length}`);

    if (articles.length === 0) {
      console.log('⚠️  该订阅源暂无文章\n');
      continue;
    }

    for (const article of articles) {
      const articleId = article.id;
      const articleUrl = `https://mp.weixin.qq.com/s/${articleId}`;

      console.log(`  📄 ${article.title || '(无标题)'}`);
      console.log(`     URL: ${articleUrl}`);

      try {
        const startTime = Date.now();
        const response = await got(articleUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
          },
          timeout: { request: 10000 },
        });

        const $ = cheerio.load(response.body);
        const title = $('#activity-name').text().trim();
        const author = $('#js_name').text().trim();
        const content = $('.rich_media_content').html() || '';
        const contentLength = content.length;
        const responseTime = Date.now() - startTime;

        console.log(`     ✅ 抓取成功 | ${responseTime}ms | ${(contentLength / 1024).toFixed(1)}KB`);
        console.log(`     作者: ${author}`);
      } catch (error) {
        console.log(`     ❌ 抓取失败: ${error.message}`);
      }
    }
    console.log('');
  }

  await prisma.$disconnect();
  console.log('========================================');
  console.log('测试完成');
  console.log('========================================');
}

testRandomAccounts().catch(console.error);