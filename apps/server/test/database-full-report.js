const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../data/wewe-rss.db'
    }
  }
});

async function comprehensiveDatabaseTest() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          WeWe-RSS 数据库表设计全面测试报告                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const schema = {
    Account: {
      description: '账号表 - 存储微信读书用户账号信息',
      fields: ['id', 'token', 'name', 'status', 'createdAt', 'updatedAt'],
      purpose: '管理用户登录状态和账号信息'
    },
    Feed: {
      description: '订阅源表 - 存储公众号订阅信息',
      fields: ['id', 'mpName', 'mpCover', 'mpIntro', 'status', 'syncTime', 'updateTime', 'hasHistory', 'createdAt', 'updatedAt'],
      purpose: '管理公众号订阅源和同步状态'
    },
    Article: {
      description: '文章表 - 存储公众号发布的文章',
      fields: ['id', 'mpId', 'title', 'picUrl', 'publishTime', 'content', 'author', 'url', 'status', 'qualityScore', 'createdAt', 'updatedAt'],
      purpose: '存储抓取的文章内容'
    },
    ArticleRun: {
      description: '文章抓取运行记录 - 记录每次抓取任务',
      fields: ['id', 'feedId', 'startTime', 'endTime', 'status', 'articlesProcessed', 'articlesSuccess', 'articlesFailed', 'errors'],
      purpose: '跟踪文章抓取任务的执行情况'
    },
    ExtractionLog: {
      description: '抽取日志 - 记录文章内容抽取详情',
      fields: ['id', 'articleId', 'runId', 'status', 'errorType', 'errorMsg', 'qualityScore', 'contentLength', 'createdAt'],
      purpose: '记录每次抽取的详细日志和质量评分'
    }
  };

  console.log('📋 数据库 Schema 设计概览:\n');

  for (const [tableName, info] of Object.entries(schema)) {
    console.log(`  ${tableName} (${info.description})`);
    console.log(`    字段: ${info.fields.join(', ')}`);
    console.log(`    用途: ${info.purpose}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 数据库实际状态测试\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const testResults = [];

  for (const [tableName, info] of Object.entries(schema)) {
    process.stdout.write(`测试 ${tableName} 表... `);

    try {
      const model = prisma[tableName.charAt(0).toLowerCase() + tableName.slice(1).replace(/([A-Z])/g, (match, p1, offset) => {
        if (offset === 0) return p1.toLowerCase();
        return '_' + p1.toLowerCase();
      })];

      if (!model || typeof model.findMany !== 'function') {
        throw new Error(`Model ${tableName} not accessible via Prisma Client`);
      }

      const count = await model.count();
      const samples = await model.findMany({ take: 1 });

      console.log(`✓ 通过 (${count} 条记录)`);
      if (samples.length > 0) {
        console.log(`   示例: ${JSON.stringify(samples[0]).substring(0, 100)}...`);
      }

      testResults.push({
        table: tableName,
        status: 'passed',
        count,
        fields: info.fields,
        purpose: info.purpose
      });

    } catch (error) {
      console.log(`⚠ 未创建或未迁移`);
      console.log(`   原因: ${error.message}`);

      testResults.push({
        table: tableName,
        status: 'not_created',
        fields: info.fields,
        purpose: info.purpose,
        error: error.message
      });
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 测试结果汇总\n');

  const passed = testResults.filter(r => r.status === 'passed');
  const notCreated = testResults.filter(r => r.status === 'not_created');

  console.log(`✓ 已创建并正常: ${passed.length} 个表\n`);

  for (const result of passed) {
    console.log(`  ✓ ${result.table} - ${result.count} 条记录`);
    console.log(`    用途: ${result.purpose}\n`);
  }

  if (notCreated.length > 0) {
    console.log(`⚠ 未创建: ${notCreated.length} 个表\n`);

    for (const result of notCreated) {
      console.log(`  ⚠ ${result.table}`);
      console.log(`    用途: ${result.purpose}`);
      console.log(`    字段: ${result.fields.join(', ')}\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📝 表关系说明\n');

  console.log('  Article (mpId) ──────────► Feed (id)');
  console.log('       │                           ');
  console.log('       │                           ');
  console.log('       ▼                           ');
  console.log('  ExtractionLog ◄───── ArticleRun');
  console.log('       │                  │        ');
  console.log('       │                  │        ');
  console.log('       └──────────────────┘        ');
  console.log('           (runId)                 \n');

  console.log('  说明:');
  console.log('    • Article.mpId 关联 Feed.id，表示文章所属的公众号');
  console.log('    • ExtractionLog.articleId 关联 Article.id，记录文章抽取详情');
  console.log('    • ExtractionLog.runId 关联 ArticleRun.id，记录所属任务');
  console.log('    • ArticleRun.feedId 关联 Feed.id，记录任务对应的订阅源\n');

  console.log('═══════════════════════════════════════════════════════════════');

  if (notCreated.length > 0) {
    console.log('\n🔧 建议操作:\n');
    console.log('  运行以下命令创建缺失的表:\n');
    console.log('    cd apps/server');
    console.log('    set DATABASE_URL=file:../data/wewe-rss.db');
    console.log('    npx prisma migrate dev --name add_article_runs_and_logs\n');
  }

  console.log('✓ 数据库表设计测试完成!\n');

  await prisma.$disconnect();
}

comprehensiveDatabaseTest().catch(console.error);
