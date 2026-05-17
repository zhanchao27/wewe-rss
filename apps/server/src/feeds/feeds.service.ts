import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@server/prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { TrpcService } from '@server/trpc/trpc.service';
import { feedMimeTypeMap, feedTypes } from '@server/constants';
import { ConfigService } from '@nestjs/config';
import { Article, Feed as FeedInfo } from '@prisma/client';
import { ConfigurationType } from '@server/configuration';
import { Feed, Item } from 'feed';
import got, { Got } from 'got';
import { load } from 'cheerio';
import { minify } from 'html-minifier';
import { LRUCache } from 'lru-cache';
import pMap from '@cjs-exporter/p-map';

console.log('CRON_EXPRESSION: ', process.env.CRON_EXPRESSION);

const mpCache = new LRUCache<string, string>({
  max: 5000,
});

// 防封号配置
const SAFE_CONFIG = {
  // 单次抓取公众号数量限制
  MAX_FEEDS_PER_BATCH: 3,
  // 每公众号抓取文章数限制
  MAX_ARTICLES_PER_FEED: 5,
  // 最小延迟（秒）
  MIN_DELAY_SECONDS: 30,
  // 最大延迟（秒）
  MAX_DELAY_SECONDS: 120,
  // 批次间隔（秒）
  BATCH_INTERVAL_SECONDS: 300,
  // 每日最大抓取次数
  DAILY_MAX_REQUESTS: 100,
};

// User-Agent 池（轮换使用）
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

// 获取随机 User-Agent
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// 获取随机延迟（秒）
function getRandomDelay(): number {
  return Math.floor(
    Math.random() * (SAFE_CONFIG.MAX_DELAY_SECONDS - SAFE_CONFIG.MIN_DELAY_SECONDS) +
      SAFE_CONFIG.MIN_DELAY_SECONDS,
  );
}

// 获取今日已抓取次数（简单实现）
let todayRequests = 0;
let lastDate = '';

function checkDailyLimit(): boolean {
  const today = new Date().toDateString();
  if (today !== lastDate) {
    todayRequests = 0;
    lastDate = today;
  }
  return todayRequests < SAFE_CONFIG.DAILY_MAX_REQUESTS;
}

function incrementRequestCount(): void {
  todayRequests++;
}

@Injectable()
export class FeedsService {
  private readonly logger = new Logger(this.constructor.name);

  private request: Got;
  constructor(
    private readonly prismaService: PrismaService,
    private readonly trpcService: TrpcService,
    private readonly configService: ConfigService,
  ) {
    this.request = got.extend({
      retry: {
        limit: 3,
        methods: ['GET'],
      },
      timeout: 8 * 1e3,
      hooks: {
        beforeRequest: [
          (options) => {
            // 每次请求使用随机 User-Agent
            options.headers = {
              ...options.headers,
              accept:
                'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
              'accept-encoding': 'gzip, deflate, br',
              'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
              'cache-control': 'max-age=0',
              'sec-ch-ua':
                '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"Windows"',
              'sec-fetch-dest': 'document',
              'sec-fetch-mode': 'navigate',
              'sec-fetch-site': 'none',
              'sec-fetch-user': '?1',
              'upgrade-insecure-requests': '1',
              'user-agent': getRandomUserAgent(),
              referer: 'https://mp.weixin.qq.com/',
              connection: 'keep-alive',
            };
          },
        ],
        beforeRetry: [
          async (options, error, retryCount) => {
            this.logger.warn(`retrying ${options.url}... (attempt ${retryCount || 1})`);
            // 重试前等待更长时间
            const delay = 5e3 * (retryCount || 1) + getRandomDelay() * 1e3;
            return new Promise((resolve) => setTimeout(resolve, delay));
          },
        ],
        afterResponse: [
          (response) => {
            const statusCode = response.statusCode;
            if (statusCode === 403 || statusCode === 429) {
              this.logger.warn(`请求被拒绝，状态码: ${statusCode}`);
              // 遇到限流，强制等待较长时间
              return new Promise((resolve) =>
                setTimeout(() => resolve(response), 300e3),
              );
            }
            return response;
          },
        ],
      },
    });
  }

  @Cron(process.env.CRON_EXPRESSION || '35 5,17 * * *', {
    name: 'updateFeeds',
    timeZone: 'Asia/Shanghai',
  })
  async handleUpdateFeedsCron() {
    this.logger.debug('Called handleUpdateFeedsCron');

    // 检查每日抓取限制
    if (!checkDailyLimit()) {
      this.logger.warn('已达到每日最大抓取次数限制，跳过本次定时任务');
      return;
    }

    let feeds = await this.prismaService.feed.findMany({
      where: { status: 1 },
    });
    this.logger.debug(`feeds length: ${feeds.length}`);

    // 随机打乱公众号顺序，避免固定抓取顺序被检测
    feeds = feeds.sort(() => Math.random() - 0.5);

    const updateDelayTime =
      this.configService.get<ConfigurationType['feed']>(
        'feed',
      )!.updateDelayTime;

    // 分批处理，每批最多 MAX_FEEDS_PER_BATCH 个公众号
    for (let i = 0; i < feeds.length; i += SAFE_CONFIG.MAX_FEEDS_PER_BATCH) {
      const batch = feeds.slice(i, i + SAFE_CONFIG.MAX_FEEDS_PER_BATCH);
      this.logger.debug(`处理批次 ${Math.floor(i / SAFE_CONFIG.MAX_FEEDS_PER_BATCH) + 1}，共 ${batch.length} 个公众号`);

      for (const feed of batch) {
        // 检查每日限制
        if (!checkDailyLimit()) {
          this.logger.warn('已达到每日最大抓取次数限制，停止抓取');
          return;
        }

        this.logger.debug(`开始抓取公众号: ${feed.mpName} (${feed.id})`);
        try {
          // 抓取前随机延迟
          const preDelay = getRandomDelay();
          this.logger.debug(`抓取前等待 ${preDelay} 秒...`);
          await new Promise((resolve) => setTimeout(resolve, preDelay * 1e3));

          // 执行抓取
          incrementRequestCount();
          await this.trpcService.refreshMpArticlesAndUpdateFeed(feed.id);

          this.logger.debug(`公众号 ${feed.mpName} 抓取完成`);

          // 抓取后随机延迟
          const postDelay = getRandomDelay();
          this.logger.debug(`抓取后等待 ${postDelay} 秒...`);
          await new Promise((resolve) => setTimeout(resolve, postDelay * 1e3));

        } catch (err) {
          this.logger.error(`抓取公众号 ${feed.mpName} 失败: ${err.message}`);
          // 失败时等待更长时间再继续
          await new Promise((resolve) =>
            setTimeout(resolve, SAFE_CONFIG.MAX_DELAY_SECONDS * 1e3),
          );
        }
      }

      // 批次之间等待更长时间
      if (i + SAFE_CONFIG.MAX_FEEDS_PER_BATCH < feeds.length) {
        const batchDelay = SAFE_CONFIG.BATCH_INTERVAL_SECONDS;
        this.logger.debug(`批次间隔等待 ${batchDelay} 秒...`);
        await new Promise((resolve) => setTimeout(resolve, batchDelay * 1e3));
      }
    }

    this.logger.debug('handleUpdateFeedsCron 完成');
  }

  async cleanHtml(source: string) {
    const $ = load(source, { decodeEntities: false });

    const dirtyHtml = $.html($('.rich_media_content'));

    const html = dirtyHtml
      .replace(/data-src=/g, 'src=')
      .replace(/opacity: 0( !important)?;/g, '')
      .replace(/visibility: hidden;/g, '');

    const content =
      '<style> .rich_media_content {overflow: hidden;color: #222;font-size: 17px;word-wrap: break-word;-webkit-hyphens: auto;-ms-hyphens: auto;hyphens: auto;text-align: justify;position: relative;z-index: 0;}.rich_media_content {font-size: 18px;}</style>' +
      html;

    const result = minify(content, {
      removeAttributeQuotes: true,
      collapseWhitespace: true,
    });

    return result;
  }

  async getHtmlByUrl(url: string) {
    const html = await this.request(url, { responseType: 'text' }).text();
    if (
      this.configService.get<ConfigurationType['feed']>('feed')!.enableCleanHtml
    ) {
      const result = await this.cleanHtml(html);
      return result;
    }

    return html;
  }

  async tryGetContent(id: string) {
    // 优先从缓存获取
    let content = mpCache.get(id);
    if (content) {
      return content;
    }

    const url = `https://mp.weixin.qq.com/s/${id}`;
    
    // 检查每日抓取限制
    if (!checkDailyLimit()) {
      this.logger.warn('已达到每日最大抓取次数限制，跳过文章内容抓取');
      return '获取全文失败，今日抓取次数已达上限~';
    }

    try {
      // 抓取前随机延迟
      const delay = getRandomDelay() * 0.5; // 文章抓取延迟减半
      await new Promise((resolve) => setTimeout(resolve, delay * 1e3));

      incrementRequestCount();
      content = await this.getHtmlByUrl(url);
      this.logger.debug(`成功抓取文章内容: ${url}`);

    } catch (e) {
      this.logger.error(`getHtmlByUrl(${url}) error: ${e.message}`);
      
      // 如果是 403/429，说明被限流
      if (e.response && (e.response.statusCode === 403 || e.response.statusCode === 429)) {
        this.logger.warn(`文章抓取被拒绝，状态码: ${e.response.statusCode}，等待后重试`);
        await new Promise((resolve) => setTimeout(resolve, 300e3)); // 等待5分钟后重试一次
        try {
          incrementRequestCount();
          content = await this.getHtmlByUrl(url);
        } catch (retryErr) {
          this.logger.error(`重试抓取文章失败: ${retryErr.message}`);
          content = '获取全文失败，请稍后重试~';
        }
      } else {
        content = '获取全文失败，请重试~';
      }
    }

    // 只有成功获取到内容才缓存
    if (content && !content.includes('获取全文失败')) {
      mpCache.set(id, content);
    }
    
    return content;
  }

  async renderFeed({
    type,
    feedInfo,
    articles,
    mode,
  }: {
    type: string;
    feedInfo: FeedInfo;
    articles: Article[];
    mode?: string;
  }) {
    const { originUrl, mode: globalMode } =
      this.configService.get<ConfigurationType['feed']>('feed')!;

    const link = `${originUrl}/feeds/${feedInfo.id}.${type}`;

    const feed = new Feed({
      title: feedInfo.mpName,
      description: feedInfo.mpIntro,
      id: link,
      link: link,
      language: 'zh-cn', // optional, used only in RSS 2.0, possible values: http://www.w3.org/TR/REC-html40/struct/dirlang.html#langcodes
      image: feedInfo.mpCover,
      favicon: feedInfo.mpCover,
      copyright: '',
      updated: new Date(feedInfo.updateTime * 1e3),
      generator: 'WeWe-RSS',
      author: { name: feedInfo.mpName },
    });

    feed.addExtension({
      name: 'generator',
      objects: `WeWe-RSS`,
    });

    const feeds = await this.prismaService.feed.findMany({
      select: { id: true, mpName: true },
    });

    /**mode 高于 globalMode。如果 mode 值存在，取 mode 值*/
    const enableFullText =
      typeof mode === 'string'
        ? mode === 'fulltext'
        : globalMode === 'fulltext';

    const showAuthor = feedInfo.id === 'all';

    const mapper = async (item) => {
      const { title, id, publishTime, picUrl, mpId } = item;
      const link = `https://mp.weixin.qq.com/s/${id}`;

      const mpName = feeds.find((item) => item.id === mpId)?.mpName || '-';
      const published = new Date(publishTime * 1e3);

      let content = '';
      if (enableFullText) {
        content = await this.tryGetContent(id);
      }

      feed.addItem({
        id,
        title,
        link: link,
        guid: link,
        content,
        date: published,
        image: picUrl,
        author: showAuthor ? [{ name: mpName }] : undefined,
      });
    };

    await pMap(articles, mapper, { concurrency: 2, stopOnError: false });

    return feed;
  }

  async handleGenerateFeed({
    id,
    type,
    limit,
    page,
    mode,
    title_include,
    title_exclude,
  }: {
    id?: string;
    type: string;
    limit: number;
    page: number;
    mode?: string;
    title_include?: string;
    title_exclude?: string;
  }) {
    if (!feedTypes.includes(type as any)) {
      type = 'atom';
    }

    let articles: Article[];
    let feedInfo: FeedInfo;
    if (id) {
      feedInfo = (await this.prismaService.feed.findFirst({
        where: { id },
      }))!;

      if (!feedInfo) {
        throw new HttpException('不存在该feed！', HttpStatus.BAD_REQUEST);
      }

      articles = await this.prismaService.article.findMany({
        where: { mpId: id },
        orderBy: { publishTime: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      });
    } else {
      articles = await this.prismaService.article.findMany({
        orderBy: { publishTime: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      });

      const { originUrl } =
        this.configService.get<ConfigurationType['feed']>('feed')!;
      feedInfo = {
        id: 'all',
        mpName: 'WeWe-RSS All',
        mpIntro: 'WeWe-RSS 全部文章',
        mpCover: originUrl
          ? `${originUrl}/favicon.ico`
          : 'https://r2-assets.111965.xyz/wewe-rss.png',
        status: 1,
        syncTime: 0,
        updateTime: Math.floor(Date.now() / 1e3),
        hasHistory: -1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    this.logger.log('handleGenerateFeed articles: ' + articles.length);
    const feed = await this.renderFeed({ feedInfo, articles, type, mode });

    if (title_include) {
      const includes = title_include.split('|');
      feed.items = feed.items.filter((i: Item) =>
        includes.some((k) => i.title.includes(k)),
      );
    }
    if (title_exclude) {
      const excludes = title_exclude.split('|');
      feed.items = feed.items.filter(
        (i: Item) => !excludes.some((k) => i.title.includes(k)),
      );
    }

    switch (type) {
      case 'rss':
        return { content: feed.rss2(), mimeType: feedMimeTypeMap[type] };
      case 'json':
        return { content: feed.json1(), mimeType: feedMimeTypeMap[type] };
      case 'atom':
      default:
        return { content: feed.atom1(), mimeType: feedMimeTypeMap[type] };
    }
  }

  async getFeedList() {
    const data = await this.prismaService.feed.findMany();

    return data.map((item) => {
      return {
        id: item.id,
        name: item.mpName,
        intro: item.mpIntro,
        cover: item.mpCover,
        syncTime: item.syncTime,
        updateTime: item.updateTime,
      };
    });
  }

  async updateFeed(id: string) {
    try {
      await this.trpcService.refreshMpArticlesAndUpdateFeed(id);
    } catch (err) {
      this.logger.error('updateFeed error', err);
    } finally {
      // wait 30s for next feed
      await new Promise((resolve) => setTimeout(resolve, 30 * 1e3));
    }
  }
}
