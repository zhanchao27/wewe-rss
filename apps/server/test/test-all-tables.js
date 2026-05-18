const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../data/wewe-rss.db'
    }
  }
});

async function testAllTables() {
  console.log('=== 数据库表全面测试 ===\n');

  const results = [];

  console.log('1. 测试 Account 表...');
  try {
    const count = await prisma.account.count();
    console.log(`   ✓ 通过 - ${count} 条记录`);
    results.push({ table: 'Account', status: 'pass', count });
  } catch (e) {
    console.log(`   ✗ 失败: ${e.message}`);
    results.push({ table: 'Account', status: 'fail', error: e.message });
  }

  console.log('\n2. 测试 Feed 表...');
  try {
    const count = await prisma.feed.count();
    console.log(`   ✓ 通过 - ${count} 条记录`);
    results.push({ table: 'Feed', status: 'pass', count });
  } catch (e) {
    console.log(`   ✗ 失败: ${e.message}`);
    results.push({ table: 'Feed', status: 'fail', error: e.message });
  }

  console.log('\n3. 测试 Article 表...');
  try {
    const count = await prisma.article.count();
    console.log(`   ✓ 通过 - ${count} 条记录`);
    results.push({ table: 'Article', status: 'pass', count });
  } catch (e) {
    console.log(`   ✗ 失败: ${e.message}`);
    results.push({ table: 'Article', status: 'fail', error: e.message });
  }

  console.log('\n4. 测试 ArticleRun 表...');
  try {
    const count = await prisma.articleRun.count();
    console.log(`   ✓ 通过 - ${count} 条记录`);
    results.push({ table: 'ArticleRun', status: 'pass', count });
  } catch (e) {
    console.log(`   ✗ 失败: ${e.message}`);
    results.push({ table: 'ArticleRun', status: 'fail', error: e.message });
  }

  console.log('\n5. 测试 ExtractionLog 表...');
  try {
    const count = await prisma.extractionLog.count();
    console.log(`   ✓ 通过 - ${count} 条记录`);
    results.push({ table: 'ExtractionLog', status: 'pass', count });
  } catch (e) {
    console.log(`   ✗ 失败: ${e.message}`);
    results.push({ table: 'ExtractionLog', status: 'fail', error: e.message });
  }

  console.log('\n=== 测试结果汇总 ===\n');

  const passed = results.filter(r => r.status === 'pass');
  const failed = results.filter(r => r.status === 'fail');

  console.log(`✓ 通过: ${passed.length}/5`);
  passed.forEach(r => console.log(`  - ${r.table}: ${r.count} 条记录`));

  if (failed.length > 0) {
    console.log(`\n✗ 失败: ${failed.length}/5`);
    failed.forEach(r => console.log(`  - ${r.table}: ${r.error}`));
  } else {
    console.log('\n✓ 所有数据库表测试通过！');
  }

  await prisma.$disconnect();
}

testAllTables().catch(console.error);
