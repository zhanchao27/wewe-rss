/**
 * 每日抓取情况报告生成脚本
 *
 * 功能：
 * 1. 从数据库获取当日抓取统计
 * 2. 生成Markdown格式日报
 * 3. 支持定时任务自动执行
 * 4. 支持3天快速测试结果整合
 *
 * 使用方式：
 *   node test/daily-report.js              # 生成今日报告
 *   node test/daily-report.js --date=2026-05-23  # 生成指定日期报告
 *   node test/daily-report.js --watch     # 监控模式，每小时更新
 *   node test/daily-report.js --3day       # 生成3天测试综合报告
 */

const fs = require('fs');
const path = require('path');

const REPORT_DIR = path.join(__dirname, 'data', 'daily-reports');
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'wewe-rss.db');

async function getDailyStats(date) {
  const args = process.argv.slice(2);
  const dbUrlArg = args.find(arg => arg.startsWith('--db-url='));
  const dbUrl = dbUrlArg ? dbUrlArg.split('=')[1] : process.env.DATABASE_URL || 'file:../data/wewe-rss.db';

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } }
  });

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const startTimestamp = Math.floor(startOfDay.getTime() / 1000);
  const endTimestamp = Math.floor(endOfDay.getTime() / 1000);

  const [
    totalArticles,
    todayArticles,
    feeds,
    recentArticles,
    articleRuns,
  ] = await Promise.all([
    prisma.article.count(),
    prisma.article.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    }),
    prisma.feed.count({ where: { status: 1 } }),
    prisma.article.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        author: true,
        content: true,
        createdAt: true,
      },
    }),
    prisma.articleRun.findMany({
      where: {
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { startTime: 'desc' },
      take: 5,
    }),
  ]);

  await prisma.$disconnect();

  return {
    date,
    totalArticles,
    todayArticles,
    activeFeeds: feeds,
    recentArticles,
    articleRuns,
  };
}

function calculateContentStats(articles) {
  const withContent = articles.filter(a => a.content && a.content.length > 100);
  const withoutContent = articles.filter(a => !a.content || a.content.length < 100);
  const emptyTitles = articles.filter(a => !a.title || a.title === '无标题');

  const totalContentSize = withContent.reduce((sum, a) => sum + (a.content?.length || 0), 0);
  const avgContentSize = withContent.length > 0 ? totalContentSize / withContent.length : 0;

  return {
    withContent: withContent.length,
    withoutContent: withoutContent.length,
    emptyTitles: emptyTitles.length,
    avgContentSize: Math.round(avgContentSize / 1024),
    totalContentSize: Math.round(totalContentSize / 1024),
  };
}

function generateMarkdownReport(stats) {
  const contentStats = calculateContentStats(stats.recentArticles);

  const articleList = stats.recentArticles
    .map((a, i) => {
      const time = new Date(a.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      const contentLen = a.content ? a.content.length : 0;
      const contentPreview = contentLen > 0
        ? `${(contentLen / 1024).toFixed(1)}KB`
        : '无内容';
      return `| ${i + 1} | ${a.title || '无标题'} | ${a.author || '未知'} | ${contentPreview} | ${time} |`;
    })
    .join('\n');

  const runList = stats.articleRuns.length > 0
    ? stats.articleRuns
        .map(r => {
          const start = new Date(r.startTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
          const duration = r.endTime
            ? Math.round((new Date(r.endTime) - new Date(r.startTime)) / 1000) + '秒'
            : '进行中';
          return `| ${start} | ${r.status} | ${r.articlesProcessed} | ${r.articlesSuccess} | ${duration} |`;
        })
        .join('\n')
    : '| - | - | - | - | - |';

  return `# 📊 每日抓取情况报告

**日期**: ${stats.date}

---

## 📈 总体统计

| 指标 | 数值 |
|------|------|
| 数据库文章总数 | ${stats.totalArticles} |
| 今日新增文章 | ${stats.todayArticles} |
| 活跃订阅源 | ${stats.activeFeeds} |
| 抓取任务执行 | ${stats.articleRuns.length} 次 |

## 📝 内容质量统计

| 指标 | 数值 |
|------|------|
| 有完整内容 | ${contentStats.withContent} 篇 |
| 无/少内容 | ${contentStats.withoutContent} 篇 |
| 无标题文章 | ${contentStats.emptyTitles} 篇 |
| 平均内容大小 | ${contentStats.avgContentSize} KB |
| 今日内容总量 | ${contentStats.totalContentSize} KB |

## 📋 今日抓取文章列表

| # | 标题 | 作者 | 内容大小 | 时间 |
|---|------|------|---------|------|
${articleList}

## 🔄 抓取任务记录

| 开始时间 | 状态 | 处理 | 成功 | 耗时 |
|----------|------|------|------|------|
${runList}

## 📌 备注

- 报告生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
- 如有问题请检查 logs 目录下的日志文件

---

*由每日报告脚本自动生成*
`;
}

function saveReport(markdown, date) {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const dailyDir = path.join(REPORT_DIR, date);
  if (!fs.existsSync(dailyDir)) {
    fs.mkdirSync(dailyDir, { recursive: true });
  }

  const filepath = path.join(dailyDir, 'daily-report.md');
  fs.writeFileSync(filepath, markdown);
  console.log(`📝 报告已保存: ${filepath}`);

  const indexPath = path.join(REPORT_DIR, 'INDEX.md');
  updateIndex(indexPath, date);

  return filepath;
}

function updateIndex(indexPath, date) {
  let content = '';

  if (fs.existsSync(indexPath)) {
    content = fs.readFileSync(indexPath, 'utf-8');
  } else {
    content = `# 📊 每日抓取报告索引\n\n---\n\n## 报告列表\n\n`;
  }

  const entry = `- **${date}** - [查看报告](./${date}/daily-report.md)`;

  if (!content.includes(date)) {
    content = content.replace(
      /(## 报告列表\n\n)/,
      `${entry}\n`
    );
    fs.writeFileSync(indexPath, content);
    console.log(`📑 索引已更新: ${indexPath}`);
  }
}

const TRACKER_DIR = path.join(__dirname, 'test', 'data', 'daily-reports', '3day-rapid-test');

function generate3DayTestReport() {
  const stateFile = path.join(TRACKER_DIR, 'test-state.json');

  if (!fs.existsSync(stateFile)) {
    console.log('❌ 未找到3天测试状态文件，请先运行测试');
    return null;
  }

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║              3天快速测试报告                                 ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log(`测试状态: ${state.status}`);
  console.log(`开始时间: ${new Date(state.startedAt).toLocaleString('zh-CN')}`);
  console.log(`当前天数: 第${state.currentDay}天\n`);

  if (state.results && state.results.length > 0) {
    console.log('已完成测试:');
    state.results.forEach(r => {
      console.log(`  第${r.day}天 - ${r.phase === 1 ? '基线测试' : r.phase === 2 ? '小幅加压' : '确定上限'}`);
      console.log(`    成功率: ${r.successRate.toFixed(2)}%`);
      console.log(`    请求数: ${r.totalRequests} (成功: ${r.successfulRequests}, 失败: ${r.failedRequests})`);
    });
  } else {
    console.log('尚未开始测试');
  }

  return state;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--3day')) {
    generate3DayTestReport();
    return;
  }

  let date = new Date().toISOString().split('T')[0];

  const dateArg = args.find(arg => arg.startsWith('--date='));
  if (dateArg) {
    date = dateArg.split('=')[1];
  }

  const watchMode = args.includes('--watch');

  async function generate() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  每日抓取报告生成器`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\n📅 生成日期: ${date}\n`);

    try {
      const stats = await getDailyStats(date);
      const markdown = generateMarkdownReport(stats);
      saveReport(markdown, date);
      console.log('\n✅ 报告生成完成！\n');
    } catch (error) {
      console.error('❌ 生成报告失败:', error.message);
    }
  }

  if (watchMode) {
    console.log('🔄 监控模式启动，每小时更新一次...\n');
    await generate();
    setInterval(async () => {
      date = new Date().toISOString().split('T')[0];
      await generate();
    }, 3600000);
  } else {
    await generate();
  }
}

main().catch(console.error);
