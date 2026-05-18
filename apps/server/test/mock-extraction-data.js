const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../data/wewe-rss.db'
    }
  }
});

async function generateMockData() {
  console.log('=== 模拟抓取任务数据写入测试 ===\n');

  try {
    console.log('📝 步骤 1: 获取一个有效的 Feed ID...\n');
    const feeds = await prisma.feed.findMany({ take: 1 });

    if (feeds.length === 0) {
      console.log('⚠️  数据库中没有 Feed，创建一个测试 Feed...');

      const testFeed = await prisma.feed.create({
        data: {
          id: 'TEST_FEED_' + Date.now(),
          mpName: '测试公众号',
          mpCover: 'https://example.com/cover.jpg',
          mpIntro: '用于测试的公众号',
          status: 1,
          syncTime: Math.floor(Date.now() / 1000),
          updateTime: Math.floor(Date.now() / 1000),
          hasHistory: 1
        }
      });

      console.log(`✓ 测试 Feed 创建成功: ${testFeed.mpName}\n`);
      feeds.push(testFeed);
    }

    const feed = feeds[0];
    console.log(`使用 Feed: ${feed.mpName} (${feed.id})\n`);

    console.log('📝 步骤 2: 获取一些现有的 Article...\n');
    let articles = await prisma.article.findMany({
      where: { mpId: feed.id },
      take: 3
    });

    if (articles.length === 0) {
      console.log('⚠️  没有现有文章，创建一些测试文章...\n');

      const testArticles = [];
      for (let i = 1; i <= 5; i++) {
        const article = await prisma.article.create({
          data: {
            id: 'TEST_ARTICLE_' + Date.now() + '_' + i,
            mpId: feed.id,
            title: `测试文章 ${i} - ${new Date().toLocaleString()}`,
            picUrl: 'https://example.com/article' + i + '.jpg',
            publishTime: Math.floor(Date.now() / 1000) - (i * 3600),
            content: `<p>这是测试文章 ${i} 的内容...</p>`,
            author: '测试作者',
            url: 'https://mp.weixin.qq.com/s/test' + i,
            status: 0,
            qualityScore: 0
          }
        });
        testArticles.push(article);
      }

      console.log(`✓ 创建了 ${testArticles.length} 篇测试文章\n`);
      articles = testArticles;
    }

    articles.forEach((article, idx) => {
      console.log(`  ${idx + 1}. ${article.title.substring(0, 40)}...`);
    });
    console.log('');

    console.log('📝 步骤 3: 创建 ArticleRun 记录（抓取任务）...\n');

    const runId = 'TEST_RUN_' + Date.now();
    const startTime = new Date();

    const articleRun = await prisma.articleRun.create({
      data: {
        id: runId,
        feedId: feed.id,
        startTime: startTime,
        status: 'running',
        articlesProcessed: articles.length,
        articlesSuccess: 0,
        articlesFailed: 0
      }
    });

    console.log(`✓ ArticleRun 创建成功!`);
    console.log(`  ID: ${articleRun.id}`);
    console.log(`  Feed: ${articleRun.feedId}`);
    console.log(`  开始时间: ${articleRun.startTime}`);
    console.log(`  状态: ${articleRun.status}`);
    console.log(`  待处理文章数: ${articleRun.articlesProcessed}\n`);

    console.log('📝 步骤 4: 为每篇文章创建 ExtractionLog 记录...\n');

    const extractionResults = [];
    const statuses = ['success', 'success', 'success', 'failed'];
    const errorTypes = ['NETWORK_ERROR', 'TIMEOUT', 'PARSE_ERROR', null];

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      const status = statuses[i % statuses.length];
      const errorType = status === 'failed' ? errorTypes[i % errorTypes.length] : null;

      const qualityScore = status === 'success' ? parseFloat((0.7 + Math.random() * 0.3).toFixed(2)) : null;
      const contentLength = status === 'success' ? Math.floor(Math.random() * 5000) + 1000 : null;

      const log = await prisma.extractionLog.create({
        data: {
          id: 'TEST_LOG_' + Date.now() + '_' + i,
          articleId: article.id,
          runId: runId,
          status: status,
          errorType: errorType,
          errorMsg: errorType ? '模拟错误: ' + errorType : null,
          qualityScore: qualityScore,
          contentLength: contentLength
        }
      });

      extractionResults.push({
        articleTitle: article.title.substring(0, 30) + '...',
        status: log.status,
        qualityScore: log.qualityScore,
        errorType: log.errorType
      });

      console.log(`  ✓ ${i + 1}. ${extractionResults[i].articleTitle}`);
      console.log(`     状态: ${log.status}${log.qualityScore ? ', 质量分数: ' + log.qualityScore : ''}${log.errorType ? ', 错误类型: ' + log.errorType : ''}`);
    }
    console.log('');

    console.log('📝 步骤 5: 更新 ArticleRun 状态...\n');

    const successCount = extractionResults.filter(r => r.status === 'success').length;
    const failedCount = extractionResults.filter(r => r.status === 'failed').length;

    const updatedRun = await prisma.articleRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        endTime: new Date(),
        articlesSuccess: successCount,
        articlesFailed: failedCount,
        errors: failedCount > 0 ? `处理失败 ${failedCount} 篇文章` : null
      }
    });

    console.log(`✓ ArticleRun 更新成功!`);
    console.log(`  最终状态: ${updatedRun.status}`);
    console.log(`  成功: ${updatedRun.articlesSuccess}, 失败: ${updatedRun.articlesFailed}`);
    console.log(`  结束时间: ${updatedRun.endTime}\n`);

    console.log('📝 步骤 6: 验证数据写入...\n');

    const runLogs = await prisma.extractionLog.findMany({
      where: { runId: runId }
    });

    console.log(`✓ 查询到 ${runLogs.length} 条 ExtractionLog 记录\n`);

    runLogs.forEach((log, idx) => {
      console.log(`  日志 ${idx + 1}:`);
      console.log(`    文章ID: ${log.articleId}`);
      console.log(`    状态: ${log.status}`);
      console.log(`    质量分数: ${log.qualityScore || 'N/A'}`);
      console.log(`    错误类型: ${log.errorType || 'N/A'}`);
      console.log(`    内容长度: ${log.contentLength || 'N/A'}`);
      console.log('');
    });

    console.log('📝 步骤 7: 清理测试数据...\n');

    await prisma.extractionLog.deleteMany({
      where: { id: { startsWith: 'TEST_LOG_' } }
    });

    await prisma.articleRun.delete({
      where: { id: runId }
    });

    await prisma.article.deleteMany({
      where: { id: { startsWith: 'TEST_ARTICLE_' } }
    });

    await prisma.feed.delete({
      where: { id: feed.id }
    });

    console.log('✓ 测试数据已清理\n');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ 模拟抓取任务数据写入测试完成！');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('测试覆盖的场景:');
    console.log('  ✓ 创建 ArticleRun（抓取任务）记录');
    console.log('  ✓ 创建 ExtractionLog（抽取日志）记录');
    console.log('  ✓ 模拟成功和失败的抽取场景');
    console.log('  ✓ 更新任务状态和统计信息');
    console.log('  ✓ 查询关联数据验证完整性');
    console.log('  ✓ 清理测试数据\n');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

generateMockData();
