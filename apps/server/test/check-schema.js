const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../data/wewe-rss.db'
    }
  }
});

async function checkDatabaseSchema() {
  console.log('=== 检查数据库实际 Schema ===\n');

  try {
    console.log('尝试查询 Account...');
    const accounts = await prisma.$queryRaw`SELECT * FROM accounts LIMIT 1`;
    console.log('✓ Account 表存在');
    console.log('  列:', Object.keys(accounts[0] || {}));

    console.log('\n尝试查询 Feed...');
    const feeds = await prisma.$queryRaw`SELECT * FROM feeds LIMIT 1`;
    console.log('✓ Feed 表存在');
    console.log('  列:', Object.keys(feeds[0] || {}));

    console.log('\n尝试查询 Article...');
    try {
      const articles = await prisma.$queryRaw`SELECT * FROM articles LIMIT 1`;
      console.log('✓ Article 表存在');
      console.log('  列:', Object.keys(articles[0] || {}));
    } catch (e) {
      console.log('✗ Article 表查询失败:', e.message);
    }

    console.log('\n尝试查询 ArticleRun...');
    try {
      const runs = await prisma.$queryRaw`SELECT * FROM article_runs LIMIT 1`;
      console.log('✓ ArticleRun 表存在');
      console.log('  列:', Object.keys(runs[0] || {}));
    } catch (e) {
      console.log('✗ ArticleRun 表查询失败:', e.message);
    }

    console.log('\n尝试查询 ExtractionLog...');
    try {
      const logs = await prisma.$queryRaw`SELECT * FROM extraction_logs LIMIT 1`;
      console.log('✓ ExtractionLog 表存在');
      console.log('  列:', Object.keys(logs[0] || {}));
    } catch (e) {
      console.log('✗ ExtractionLog 表查询失败:', e.message);
    }

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseSchema();
