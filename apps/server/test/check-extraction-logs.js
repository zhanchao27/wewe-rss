const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('检查 ExtractionLog 表（抓取错误记录）...');
  console.log('='.repeat(80));

  const logs = await prisma.extractionLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (logs.length === 0) {
    console.log('ExtractionLog 表为空，没有错误记录');
  } else {
    console.log(`找到 ${logs.length} 条记录:`);
    logs.forEach((log, i) => {
      const time = new Date(log.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      console.log(`${i+1}. [${time}] 文章ID: ${log.articleId}`);
      console.log(`   状态: ${log.status} | 错误类型: ${log.errorType || '无'}`);
      console.log(`   内容长度: ${log.contentLength || 0} | 质量分数: ${log.qualityScore || 'N/A'}`);
      if (log.errorMsg) {
        console.log(`   错误信息: ${log.errorMsg}`);
      }
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('检查 ArticleRun 表（抓取任务记录）...');
  console.log('='.repeat(80));

  const runs = await prisma.articleRun.findMany({
    orderBy: { startTime: 'desc' },
    take: 10,
  });

  if (runs.length === 0) {
    console.log('ArticleRun 表为空，没有抓取任务记录');
  } else {
    console.log(`找到 ${runs.length} 条记录:`);
    runs.forEach((run, i) => {
      const startTime = new Date(run.startTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      const endTime = run.endTime ? new Date(run.endTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '进行中';
      console.log(`${i+1}. [${startTime}] 任务ID: ${run.id}`);
      console.log(`   FeedID: ${run.feedId} | 状态: ${run.status}`);
      console.log(`   开始: ${startTime} | 结束: ${endTime}`);
      console.log(`   处理: ${run.articlesProcessed} | 成功: ${run.articlesSuccess} | 失败: ${run.articlesFailed}`);
      if (run.errors) {
        console.log(`   错误: ${run.errors}`);
      }
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
