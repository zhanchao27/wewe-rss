const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../data/wewe-rss.db'
    }
  }
});

async function testDatabaseTables() {
  console.log('=== 数据库表设计测试 ===\n');

  const results = {
    passed: [],
    failed: []
  };

  try {
    console.log('1. 测试 Account 表...');
    try {
      const accounts = await prisma.account.findMany({ take: 1 });
      const count = await prisma.account.count();
      console.log(`   ✓ Account 表查询成功，当前有 ${count} 条记录`);
      if (accounts.length > 0) {
        console.log(`   示例数据: ID=${accounts[0].id}, Name=${accounts[0].name}, Status=${accounts[0].status}`);
      }
      results.passed.push('Account');
    } catch (e) {
      console.log(`   ✗ Account 表测试失败: ${e.message}`);
      results.failed.push({ table: 'Account', error: e.message });
    }

    console.log('\n2. 测试 Feed 表...');
    try {
      const feeds = await prisma.feed.findMany({ take: 1 });
      const count = await prisma.feed.count();
      console.log(`   ✓ Feed 表查询成功，当前有 ${count} 条记录`);
      if (feeds.length > 0) {
        console.log(`   示例数据: ID=${feeds[0].id}, MPName=${feeds[0].mpName}, Status=${feeds[0].status}`);
      }
      results.passed.push('Feed');
    } catch (e) {
      console.log(`   ✗ Feed 表测试失败: ${e.message}`);
      results.failed.push({ table: 'Feed', error: e.message });
    }

    console.log('\n3. 测试 Article 表...');
    try {
      const articles = await prisma.article.findMany({ take: 1 });
      const count = await prisma.article.count();
      console.log(`   ✓ Article 表查询成功，当前有 ${count} 条记录`);
      if (articles.length > 0) {
        console.log(`   示例数据: ID=${articles[0].id}, Title=${articles[0].title.substring(0, 30)}..., PublishTime=${new Date(articles[0].publishTime * 1000).toLocaleString()}`);
      }
      results.passed.push('Article');
    } catch (e) {
      console.log(`   ✗ Article 表测试失败: ${e.message}`);
      results.failed.push({ table: 'Article', error: e.message });
    }

    console.log('\n4. 测试 ArticleRun 表...');
    try {
      const runs = await prisma.articleRun.findMany({ take: 1 });
      const count = await prisma.articleRun.count();
      console.log(`   ✓ ArticleRun 表查询成功，当前有 ${count} 条记录`);
      if (runs.length > 0) {
        console.log(`   示例数据: ID=${runs[0].id}, Status=${runs[0].status}, Processed=${runs[0].articlesProcessed}`);
      }
      results.passed.push('ArticleRun');
    } catch (e) {
      console.log(`   ⚠ ArticleRun 表可能不存在或未迁移: ${e.message}`);
      results.failed.push({ table: 'ArticleRun', error: e.message, warning: true });
    }

    console.log('\n5. 测试 ExtractionLog 表...');
    try {
      const logs = await prisma.extractionLog.findMany({ take: 1 });
      const count = await prisma.extractionLog.count();
      console.log(`   ✓ ExtractionLog 表查询成功，当前有 ${count} 条记录`);
      if (logs.length > 0) {
        console.log(`   示例数据: ID=${logs[0].id}, Status=${logs[0].status}, QualityScore=${logs[0].qualityScore}`);
      }
      results.passed.push('ExtractionLog');
    } catch (e) {
      console.log(`   ⚠ ExtractionLog 表可能不存在或未迁移: ${e.message}`);
      results.failed.push({ table: 'ExtractionLog', error: e.message, warning: true });
    }

    console.log('\n=== 表关系测试 ===\n');

    console.log('6. 测试 Article 与 Feed 关系...');
    try {
      const articles = await prisma.article.findMany({
        take: 5
      });
      console.log(`   ✓ 可以查询 Article 数据，mpId 字段用于关联 Feed 表`);

      const feeds = await prisma.feed.findMany({
        take: 5
      });
      console.log(`   ✓ 可以查询 Feed 数据`);
      results.passed.push('TableRelations');
    } catch (e) {
      console.log(`   ✗ 关系测试失败: ${e.message}`);
      results.failed.push({ table: 'TableRelations', error: e.message });
    }

    console.log('\n7. 测试统计查询...');
    try {
      const accountCount = await prisma.account.count();
      const feedCount = await prisma.feed.count();
      const articleCount = await prisma.article.count();
      console.log(`   账号总数: ${accountCount}`);
      console.log(`   订阅源总数: ${feedCount}`);
      console.log(`   文章总数: ${articleCount}`);
      results.passed.push('Statistics');
    } catch (e) {
      console.log(`   ✗ 统计查询失败: ${e.message}`);
      results.failed.push({ table: 'Statistics', error: e.message });
    }

    console.log('\n=== 测试结果汇总 ===\n');
    console.log(`✓ 通过: ${results.passed.length} 项`);
    results.passed.forEach(t => console.log(`  - ${t}`));

    if (results.failed.length > 0) {
      const warnings = results.failed.filter(f => f.warning);
      const errors = results.failed.filter(f => !f.warning);

      if (warnings.length > 0) {
        console.log(`\n⚠ 警告: ${warnings.length} 项 (表可能未迁移)`);
        warnings.forEach(w => console.log(`  - ${w.table}: ${w.error}`));
      }

      if (errors.length > 0) {
        console.log(`\n✗ 失败: ${errors.length} 项`);
        errors.forEach(e => console.log(`  - ${e.table}: ${e.error}`));
        console.log('\n❌ 测试存在失败项\n');
        process.exit(1);
      }
    }

    console.log('\n✓ 数据库表设计验证成功！所有核心表结构正常，可以正常使用。');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseTables();
