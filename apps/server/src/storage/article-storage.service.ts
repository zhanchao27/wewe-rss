import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@server/prisma/prisma.service';
import { TrpcService } from '@server/trpc/trpc.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import got from 'got';

interface ArticleInfo {
  id: string;
  title: string;
  publishTime: number;
  mpId: string;
  mpName: string;
}

interface DownloadResult {
  title: string;
  publishTime: number;
  localLink: string;
  originalLink: string;
  status: 'success' | 'failed';
  error?: string;
}

interface StorageConfig {
  basePath: string;
  subscriptionPath: string;
  processPath: string;
  reportPath: string;
}

@Injectable()
export class ArticleStorageService implements OnModuleInit {
  private readonly logger = new Logger(ArticleStorageService.name);
  private config: StorageConfig;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly trpcService: TrpcService,
    private readonly configService: ConfigService,
  ) {
    const basePath = this.configService.get<string>('STORAGE_PATH') || './data';
    this.config = {
      basePath,
      subscriptionPath: path.join(basePath, 'subscription'),
      processPath: path.join(basePath, 'process'),
      reportPath: path.join(basePath, 'report'),
    };
  }

  async onModuleInit() {
    this.logger.log('ArticleStorageService initialized');
    await this.ensureDirectories();
    await this.processAllFeeds();
  }

  private async ensureDirectories() {
    const dirs = [
      this.config.subscriptionPath,
      this.config.processPath,
      this.config.reportPath,
    ];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        this.logger.debug(`Directory ensured: ${dir}`);
      } catch (error) {
        this.logger.error(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  async processAllFeeds() {
    this.logger.log('Starting to process all feeds...');

    try {
      const feeds = await this.prismaService.feed.findMany({
        where: { status: 1 },
      });

      this.logger.log(`Found ${feeds.length} feeds to process`);

      for (const feed of feeds) {
        try {
          await this.processFeed(feed.id, feed.mpName);
        } catch (error) {
          this.logger.error(`Error processing feed ${feed.id}:`, error);
          await this.logError(feed.id, error);
        }
      }

      this.logger.log('All feeds processed successfully');
    } catch (error) {
      this.logger.error('Error processing feeds:', error);
    }
  }

  async processFeed(mpId: string, mpName: string) {
    this.logger.log(`Processing feed: ${mpName} (${mpId})`);

    const feedDir = path.join(this.config.subscriptionPath, this.sanitizeFileName(mpName));
    const articlesDir = path.join(feedDir, 'articles');
    await fs.mkdir(feedDir, { recursive: true });
    await fs.mkdir(articlesDir, { recursive: true });

    const existingArticles = await this.getExistingArticles(articlesDir);
    const isNewFeed = existingArticles.size === 0;

    let articles: ArticleInfo[];
    if (isNewFeed) {
      this.logger.log(`New feed detected, fetching articles from last year`);
      articles = await this.getArticlesFromLastYear(mpId);
    } else {
      this.logger.log(`Existing feed, fetching new articles only`);
      articles = await this.getNewArticles(mpId, existingArticles);
    }

    this.logger.log(`Found ${articles.length} articles to download for ${mpName}`);

    const downloadResults: DownloadResult[] = [];
    for (const article of articles) {
      const result = await this.downloadArticle(article, articlesDir);
      downloadResults.push(result);
    }

    await this.generateIndexFile(mpName, feedDir, downloadResults);
  }

  async getExistingArticles(feedDir: string): Promise<Set<string>> {
    try {
      const files = await fs.readdir(feedDir);
      const htmlFiles = files.filter((f) => f.endsWith('.html') && f !== 'index.md');
      const articleIds = new Set<string>();

      for (const file of htmlFiles) {
        const match = file.match(/^(\d{6})-(.+)\.html$/);
        if (match) {
          articleIds.add(match[2]);
        }
      }

      return articleIds;
    } catch (error) {
      this.logger.error(`Error reading directory ${feedDir}:`, error);
      return new Set();
    }
  }

  async getArticlesFromLastYear(mpId: string): Promise<ArticleInfo[]> {
    const oneYearAgo = Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000);

    const articles = await this.prismaService.article.findMany({
      where: {
        mpId,
        publishTime: { gte: oneYearAgo },
      },
      orderBy: { publishTime: 'desc' },
    });

    return articles.map((a) => ({
      id: a.id,
      title: a.title,
      publishTime: a.publishTime,
      mpId: a.mpId,
      mpName: '',
    }));
  }

  async getNewArticles(mpId: string, existingIds: Set<string>): Promise<ArticleInfo[]> {
    const articles = await this.prismaService.article.findMany({
      where: { mpId },
      orderBy: { publishTime: 'desc' },
    });

    return articles
      .filter((a) => !existingIds.has(a.title))
      .map((a) => ({
        id: a.id,
        title: a.title,
        publishTime: a.publishTime,
        mpId: a.mpId,
        mpName: '',
      }));
  }

  async downloadArticle(article: ArticleInfo, feedDir: string): Promise<DownloadResult> {
    const fileName = this.generateFileName(article);
    const filePath = path.join(feedDir, fileName);

    try {
      const htmlContent = await this.fetchArticleHtml(article.id, 3);
      await fs.writeFile(filePath, htmlContent, 'utf-8');

      this.logger.debug(`Downloaded article: ${article.title}`);

      return {
        title: article.title,
        publishTime: article.publishTime,
        localLink: `./articles/${fileName}`,
        originalLink: `https://mp.weixin.qq.com/s/${article.id}`,
        status: 'success',
      };
    } catch (error) {
      this.logger.error(`Failed to download article ${article.title}:`, error);

      return {
        title: article.title,
        publishTime: article.publishTime,
        localLink: `./articles/${fileName}`,
        originalLink: `https://mp.weixin.qq.com/s/${article.id}`,
        status: 'failed',
        error: error.message,
      };
    }
  }

  async fetchArticleHtml(articleId: string, maxRetries: number = 3): Promise<string> {
    const url = `https://mp.weixin.qq.com/s/${articleId}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await got(url, {
          timeout: 10000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36',
          },
        });

        return response.body;
      } catch (error) {
        this.logger.warn(
          `Attempt ${attempt}/${maxRetries} failed for article ${articleId}`,
        );

        if (attempt === maxRetries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }

    throw new Error(`Failed to fetch article ${articleId} after ${maxRetries} attempts`);
  }

  generateFileName(article: ArticleInfo): string {
    const date = new Date(article.publishTime * 1000);
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const sanitizedTitle = this.sanitizeFileName(article.title);
    return `${dateStr}-${sanitizedTitle}.html`;
  }

  sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '_')
      .replace(/[\x00-\x1f\x80-\x9f]/g, '')
      .substring(0, 200);
  }

  async generateIndexFile(
    mpName: string,
    feedDir: string,
    downloadResults: any[],
  ) {
    const indexPath = path.join(feedDir, `${this.sanitizeFileName(mpName)}.md`);

    const sortedResults = downloadResults.sort(
      (a, b) => b.publishTime - a.publishTime,
    );

    let mdContent = `# ${mpName}\n\n`;
    mdContent += `> 最后更新时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    mdContent += `---\n\n`;

    for (const result of sortedResults) {
      const date = new Date(result.publishTime * 1000).toLocaleString('zh-CN');

      mdContent += `## ${date}\n\n`;
      mdContent += `- **标题**: ${result.title}\n`;
      mdContent += `- **本地链接**: ${result.localLink}`;

      if (result.status === 'failed') {
        mdContent += ` ⚠️ *下载失败: ${result.error}*`;
      }

      mdContent += `\n`;
      mdContent += `- **原始链接**: ${result.originalLink}\n\n`;
      mdContent += `---\n\n`;
    }

    await fs.writeFile(indexPath, mdContent, 'utf-8');
    this.logger.debug(`Generated index file: ${indexPath}`);
  }

  async logError(feedId: string, error: any) {
    const logPath = path.join(this.config.reportPath, `error-${Date.now()}.log`);
    const logContent = `[${new Date().toISOString()}] Feed ID: ${feedId}\n`;
    const errorContent = error instanceof Error ? error.stack : JSON.stringify(error);
    await fs.writeFile(logPath, logContent + errorContent, 'utf-8');
  }
}
