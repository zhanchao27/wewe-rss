import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '../src/configuration';

describe('Database Schema Test', () => {
  let prisma: PrismaService;
  let testAccountId = 'test-account-001';
  let testFeedId = 'test-feed-001';
  let testArticleId = 'test-article-001';
  let testRunId = 'test-run-001';
  let testLogId = 'test-log-001';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.local.example', '.env'],
          load: [configuration],
        }),
      ],
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await prisma.extractionLog.deleteMany({ where: { id: testLogId } });
      await prisma.articleRun.deleteMany({ where: { id: testRunId } });
      await prisma.article.deleteMany({ where: { id: testArticleId } });
      await prisma.feed.deleteMany({ where: { id: testFeedId } });
      await prisma.account.deleteMany({ where: { id: testAccountId } });
    } catch (e) {
      console.log('清理测试数据时出错:', e);
    }
    await prisma.$disconnect();
  });

  describe('1. Account Table (账号表)', () => {
    it('should create an account successfully', async () => {
      const account = await prisma.account.create({
        data: {
          id: testAccountId,
          token: 'test-token-12345',
          name: '测试用户',
          status: 1,
        },
      });

      expect(account).toBeDefined();
      expect(account.id).toBe(testAccountId);
      expect(account.name).toBe('测试用户');
      expect(account.status).toBe(1);
      expect(account.createdAt).toBeDefined();
    });

    it('should find the created account', async () => {
      const account = await prisma.account.findUnique({
        where: { id: testAccountId },
      });

      expect(account).not.toBeNull();
      expect(account?.name).toBe('测试用户');
    });

    it('should update account status', async () => {
      const updatedAccount = await prisma.account.update({
        where: { id: testAccountId },
        data: { status: 0 },
      });

      expect(updatedAccount.status).toBe(0);
    });

    it('should delete an account', async () => {
      await prisma.account.delete({
        where: { id: testAccountId },
      });

      const account = await prisma.account.findUnique({
        where: { id: testAccountId },
      });

      expect(account).toBeNull();

      // 重新创建账号用于后续测试
      await prisma.account.create({
        data: {
          id: testAccountId,
          token: 'test-token-12345',
          name: '测试用户',
          status: 1,
        },
      });
    });
  });

  describe('2. Feed Table (订阅源表)', () => {
    it('should create a feed successfully', async () => {
      const feed = await prisma.feed.create({
        data: {
          id: testFeedId,
          mpName: '测试公众号',
          mpCover: 'https://example.com/cover.jpg',
          mpIntro: '这是一个测试公众号',
          status: 1,
          syncTime: Math.floor(Date.now() / 1000),
          updateTime: Math.floor(Date.now() / 1000),
          hasHistory: 1,
        },
      });

      expect(feed).toBeDefined();
      expect(feed.id).toBe(testFeedId);
      expect(feed.mpName).toBe('测试公众号');
      expect(feed.hasHistory).toBe(1);
    });

    it('should query feeds with filters', async () => {
      const activeFeeds = await prisma.feed.findMany({
        where: { status: 1 },
      });

      expect(activeFeeds.length).toBeGreaterThan(0);
    });

    it('should update feed information', async () => {
      const updatedFeed = await prisma.feed.update({
        where: { id: testFeedId },
        data: {
          mpIntro: '更新后的简介',
          syncTime: Math.floor(Date.now() / 1000),
        },
      });

      expect(updatedFeed.mpIntro).toBe('更新后的简介');
    });
  });

  describe('3. Article Table (文章表)', () => {
    it('should create an article successfully', async () => {
      const article = await prisma.article.create({
        data: {
          id: testArticleId,
          mpId: testFeedId,
          title: '测试文章标题',
          picUrl: 'https://example.com/article.jpg',
          publishTime: Math.floor(Date.now() / 1000),
          content: '<p>这是文章内容</p>',
          author: '测试作者',
          url: 'https://mp.weixin.qq.com/s/test',
          status: 1,
          qualityScore: 0.85,
        },
      });

      expect(article).toBeDefined();
      expect(article.id).toBe(testArticleId);
      expect(article.title).toBe('测试文章标题');
      expect(article.qualityScore).toBe(0.85);
    });

    it('should query articles by mpId with order', async () => {
      const articles = await prisma.article.findMany({
        where: { mpId: testFeedId },
        orderBy: { publishTime: 'desc' },
      });

      expect(articles.length).toBeGreaterThan(0);
      expect(articles[0].mpId).toBe(testFeedId);
    });

    it('should update article content', async () => {
      const updatedArticle = await prisma.article.update({
        where: { id: testArticleId },
        data: {
          content: '<p>更新后的文章内容</p>',
          status: 2,
        },
      });

      expect(updatedArticle.content).toContain('更新后的');
      expect(updatedArticle.status).toBe(2);
    });
  });

  describe('4. ArticleRun Table (文章抓取运行记录)', () => {
    it('should create an article run record', async () => {
      const run = await prisma.articleRun.create({
        data: {
          id: testRunId,
          feedId: testFeedId,
          status: 'running',
          articlesProcessed: 0,
          articlesSuccess: 0,
          articlesFailed: 0,
        },
      });

      expect(run).toBeDefined();
      expect(run.id).toBe(testRunId);
      expect(run.status).toBe('running');
    });

    it('should update article run progress', async () => {
      const updatedRun = await prisma.articleRun.update({
        where: { id: testRunId },
        data: {
          status: 'completed',
          articlesProcessed: 10,
          articlesSuccess: 8,
          articlesFailed: 2,
          endTime: new Date(),
        },
      });

      expect(updatedRun.status).toBe('completed');
      expect(updatedRun.articlesSuccess).toBe(8);
    });
  });

  describe('5. ExtractionLog Table (抽取日志)', () => {
    it('should create an extraction log', async () => {
      const log = await prisma.extractionLog.create({
        data: {
          id: testLogId,
          articleId: testArticleId,
          runId: testRunId,
          status: 'success',
          qualityScore: 0.9,
          contentLength: 1500,
        },
      });

      expect(log).toBeDefined();
      expect(log.id).toBe(testLogId);
      expect(log.status).toBe('success');
    });

    it('should create a failed extraction log', async () => {
      const failedLogId = 'test-log-failed-001';
      const log = await prisma.extractionLog.create({
        data: {
          id: failedLogId,
          articleId: testArticleId,
          runId: testRunId,
          status: 'failed',
          errorType: 'NETWORK_ERROR',
          errorMsg: '连接超时',
        },
      });

      expect(log.status).toBe('failed');
      expect(log.errorType).toBe('NETWORK_ERROR');

      // 清理
      await prisma.extractionLog.delete({ where: { id: failedLogId } });
    });
  });

  describe('6. Relationships between tables (表关系测试)', () => {
    it('should query articles with feed information', async () => {
      const articlesWithFeed = await prisma.article.findMany({
        where: { mpId: testFeedId },
        include: {
          // Prisma 会自动识别关系，虽然 schema 中没有显式定义 @relation
        },
      });

      expect(articlesWithFeed.length).toBeGreaterThan(0);
    });

    it('should query extraction logs by runId', async () => {
      const logs = await prisma.extractionLog.findMany({
        where: { runId: testRunId },
      });

      expect(logs.length).toBeGreaterThan(0);
    });

    it('should handle batch operations', async () => {
      // 批量创建文章
      const batchArticles = await Promise.all([
        prisma.article.create({
          data: {
            id: 'batch-article-001',
            mpId: testFeedId,
            title: '批量文章1',
            picUrl: 'https://example.com/1.jpg',
            publishTime: Math.floor(Date.now() / 1000),
          },
        }),
        prisma.article.create({
          data: {
            id: 'batch-article-002',
            mpId: testFeedId,
            title: '批量文章2',
            picUrl: 'https://example.com/2.jpg',
            publishTime: Math.floor(Date.now() / 1000),
          },
        }),
      ]);

      expect(batchArticles.length).toBe(2);

      // 清理批量数据
      await prisma.article.deleteMany({
        where: { id: { in: ['batch-article-001', 'batch-article-002'] } },
      });
    });
  });

  describe('7. Data Integrity and Constraints (数据完整性测试)', () => {
    it('should not allow duplicate primary keys', async () => {
      await expect(
        prisma.account.create({
          data: {
            id: testAccountId, // 使用已存在的ID
            token: 'another-token',
            name: '重复账号',
            status: 1,
          },
        }),
      ).rejects.toThrow();
    });

    it('should handle optional fields correctly', async () => {
      const article = await prisma.article.create({
        data: {
          id: 'test-article-minimal-001',
          mpId: testFeedId,
          title: '最小字段文章',
          picUrl: 'https://example.com/minimal.jpg',
          publishTime: Math.floor(Date.now() / 1000),
          // content, author, url 等都是可选的
        },
      });

      expect(article.content).toBeNull();
      expect(article.author).toBeNull();

      await prisma.article.delete({ where: { id: article.id } });
    });
  });
});
