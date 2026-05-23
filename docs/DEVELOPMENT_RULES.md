# 食品饮料行业 RSS 资讯平台 - 开发规则

> **文档版本**: v1.0
> **创建日期**: 2026-05-17
> **团队成员**: 产品经理 + 高级开发工程师
> **技术栈**: NestJS + React + Prisma + tRPC + SQLite/MySQL

---

## 一、项目概述

### 1.1 项目目标

- **后端目标**：抓取食品饮料行业公众号文章，对文章完整内容进行存储，针对文章内容、渠道等进行打标签
- **前端目标**：定期向客户发送抓取到的最新资讯，进行一定程度的归纳总结，最好有配图

### 1.2 核心功能模块

```
┌─────────────────────────────────────────────────────────────────┐
│                        系统架构图                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  微信公众号   │    │   RSS 生成   │    │  定时推送   │         │
│  │   抓取模块    │    │   服务       │    │  服务       │         │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      数据存储层                           │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │    │
│  │  │ Account │  │  Feed   │  │ Article │  │  Tag    │     │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    API 层 (tRPC + REST)                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      React 前端                           │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │    │
│  │  │ 订阅管理  │  │ 文章浏览  │  │ 标签管理  │  │ 推送配置 │     │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、项目结构规范

### 2.1 目录结构

```
wewe-rss/
├── apps/
│   ├── server/                    # NestJS 后端应用
│   │   ├── src/
│   │   │   ├── common/           # 公共模块
│   │   │   │   ├── decorators/  # 自定义装饰器
│   │   │   │   ├── filters/     # 全局异常过滤器
│   │   │   │   ├── guards/      # 路由守卫
│   │   │   │   ├── interceptors/# 拦截器
│   │   │   │   └── utils/       # 工具函数
│   │   │   ├── feeds/           # 订阅源管理模块
│   │   │   │   ├── dto/         # 数据传输对象
│   │   │   │   ├── entities/    # 实体定义
│   │   │   │   └── *.service.ts # 业务逻辑
│   │   │   ├── articles/        # 文章管理模块
│   │   │   │   ├── dto/
│   │   │   │   ├── entities/
│   │   │   │   └── *.service.ts
│   │   │   ├── tags/            # 标签管理模块
│   │   │   │   ├── dto/
│   │   │   │   ├── entities/
│   │   │   │   └── *.service.ts
│   │   │   ├── rss/             # RSS 生成模块
│   │   │   │   └── *.service.ts
│   │   │   ├── push/            # 推送服务模块
│   │   │   │   └── *.service.ts
│   │   │   ├── storage/         # 存储服务模块
│   │   │   │   └── *.service.ts
│   │   │   ├── prisma/          # Prisma 数据库服务
│   │   │   └── trpc/            # tRPC API 层
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # 数据模型定义
│   │   │   └── migrations/      # 数据库迁移
│   │   ├── test/                # 测试文件
│   │   └── data/                # 本地数据（dev）
│   │
│   └── web/                     # React 前端应用（待开发）
│       ├── src/
│       │   ├── components/      # 公共组件
│       │   ├── pages/           # 页面组件
│       │   ├── hooks/           # 自定义 Hooks
│       │   ├── services/        # API 调用
│       │   ├── stores/          # 状态管理
│       │   └── utils/           # 工具函数
│       └── public/
│
├── packages/                    # 共享包（待扩展）
│   └── shared/                  # 前后端共享类型定义
│
├── docs/                        # 项目文档
├── scripts/                     # 运维脚本
└── README.md
```

### 2.2 命名规范

#### 文件命名

| 类型 | 规范 | 示例 |
|------|------|------|
| 业务模块 | `*.module.ts` | `feeds.module.ts` |
| 服务类 | `*.service.ts` | `feeds.service.ts` |
| 控制器 | `*.controller.ts` | `feeds.controller.ts` |
| 实体类 | `*.entity.ts` | `article.entity.ts` |
| DTO | `*.dto.ts` | `create-feed.dto.ts` |
| 测试文件 | `*.spec.ts` | `feeds.service.spec.ts` |
| 类型定义 | `*.type.ts` | `feed.type.ts` |

#### 变量命名

```typescript
// 变量命名
const articleCount = 100;           // 普通变量：camelCase
const MAX_RETRY = 3;                // 常量：UPPER_SNAKE_CASE
let isLoading = false;              // 布尔值：is/has/can 前缀

// 类命名：PascalCase
class ArticleService {}
class FeedController {}

// 枚举命名：PascalCase，成员：UPPER_SNAKE_CASE
enum FeedStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

// 接口命名：PascalCase
interface ArticleResponse {}
type CreateArticleDto = {};

// 数据库表/字段：snake_case
// schema.prisma: article_id, publish_time, created_at
```

---

## 三、代码规范

### 3.1 TypeScript 规范

```typescript
// ✅ 推荐：使用 interface 定义对象结构
interface Article {
  id: string;
  title: string;
  content: string | null;
}

// ✅ 推荐：使用 type 定义联合类型、工具类型
type FeedStatus = 'active' | 'inactive';
type ArticleWithFeed = Article & { feed: Feed };

// ✅ 推荐：显式返回类型
async function fetchArticle(id: string): Promise<Article | null> {
  return await prisma.article.findUnique({ where: { id } });
}

// ✅ 推荐：使用可选链和空值合并
const title = article?.title ?? '无标题';

// ❌ 避免：any 类型
function handleData(data: any) { }  // 不推荐

// ✅ 替代：使用 unknown 或具体类型
function handleData(data: unknown) {
  if (typeof data === 'string') {
    // 处理字符串
  }
}
```

### 3.2 异步编程规范

```typescript
// ✅ 推荐：async/await
async function getArticles() {
  const articles = await prisma.article.findMany();
  return articles;
}

// ✅ 推荐：错误处理
async function safeFetch(url: string) {
  try {
    const response = await got(url);
    return response.body;
  } catch (error) {
    logger.error(`Fetch failed: ${url}`, error);
    return null;
  }
}

// ✅ 推荐：并行处理
const [articles, feeds] = await Promise.all([
  prisma.article.findMany(),
  prisma.feed.findMany(),
]);
```

### 3.3 错误处理规范

```typescript
// ✅ 推荐：自定义业务异常
class ArticleNotFoundException extends HttpException {
  constructor(id: string) {
    super(`文章不存在: ${id}`, HttpStatus.NOT_FOUND);
  }
}

// ✅ 推荐：使用 Result 模式进行无害处理
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function fetchArticle(id: string): Promise<Result<Article>> {
  try {
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      return { success: false, error: 'Article not found' };
    }
    return { success: true, data: article };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

### 3.4 日志规范

```typescript
// ✅ 推荐：使用 NestJS Logger
import { Logger } from '@nestjs/common';

@Injectable()
export class FeedsService {
  private readonly logger = new Logger(this.constructor.name);

  // 日志级别使用
  this.logger.debug(`处理批次 ${i + 1}/${total}`);  // 调试
  this.logger.log(`抓取成功: ${article.title}`);     // 信息
  this.logger.warn(`请求频率过高: ${feedId}`);        // 警告
  this.logger.error(`抓取失败: ${url}`, error.stack); // 错误
}

// ✅ 推荐：结构化日志
this.logger.log({
  context: 'FeedsService',
  action: 'fetchArticle',
  feedId: feed.id,
  articleCount: articles.length,
  duration: Date.now() - startTime,
});
```

---

## 四、数据库设计规范

### 4.1 表命名与字段规范

```prisma
// ✅ 推荐：表名单数形式，字段使用 snake_case
model Article {
  id          String   @id
  title       String   @map("title")
  content     String?  @map("content")
  author      String?  @map("author")
  publishTime Int      @map("publish_time")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // 外键关系
  feed        Feed     @relation(fields: [feedId], references: [id])
  feedId      String   @map("feed_id")

  @@map("articles")
}

// ❌ 避免：复数表名
model Articles {  // 不推荐
  // ...
}
```

### 4.2 索引规范

```prisma
model Article {
  // ... 字段定义

  // ✅ 推荐：为常用查询字段添加索引
  @@index([feedId])           // 按订阅源查询
  @@index([publishTime])      // 按时间排序
  @@index([feedId, publishTime]) // 组合索引
}

// ✅ 推荐：唯一索引
@@unique([mpId, url])  // 防止重复抓取
```

### 4.3 迁移规范

```bash
# ✅ 推荐：使用有意义的迁移名称
npx prisma migrate dev --name add_article_content_field
npx prisma migrate dev --name create_tag_system
npx prisma migrate dev --name add_article_tags_relation

# ❌ 避免：无意义的名称
npx prisma migrate dev --name update1
npx prisma migrate dev --name fix
```

### 4.4 数据库选择策略

| 场景 | 推荐数据库 | 原因 |
|------|-----------|------|
| 开发/测试 | SQLite | 零配置，文件级存储 |
| 小规模生产 (< 1000 用户) | SQLite | 维护简单 |
| 中大规模生产 | MySQL/PostgreSQL | 并发能力强 |
| 高可用需求 | PostgreSQL + 主从复制 | 成熟稳定 |

---

## 五、API 设计规范

### 5.1 RESTful API 设计

```
GET    /api/feeds           # 获取订阅源列表
POST   /api/feeds            # 创建订阅源
GET    /api/feeds/:id        # 获取单个订阅源
PATCH  /api/feeds/:id        # 更新订阅源
DELETE /api/feeds/:id        # 删除订阅源

GET    /api/articles         # 获取文章列表（支持分页、筛选）
GET    /api/articles/:id     # 获取单篇文章详情
POST   /api/articles/:id/tags # 为文章添加标签

GET    /api/tags             # 获取标签列表
POST   /api/tags             # 创建标签
DELETE /api/tags/:id         # 删除标签

GET    /api/rss/:feedId      # 获取指定订阅源的 RSS
GET    /api/push/logs        # 获取推送历史
```

### 5.2 tRPC API 设计

```typescript
// ✅ 推荐：使用 tRPC 进行类型安全的 API 调用
const appRouter = router({
  feed: router({
    list: publicProcedure.query(async () => {
      return await feedService.findAll();
    }),
    get: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        return await feedService.findById(input);
      }),
    create: privateProcedure
      .input(createFeedSchema)
      .mutation(async ({ input }) => {
        return await feedService.create(input);
      }),
  }),
  article: router({
    list: publicProcedure
      .input(articleListSchema)
      .query(async ({ input }) => {
        return await articleService.findAll(input);
      }),
    getContent: publicProcedure
      .input(z.string())
      .query(async ({ input }) => {
        return await articleService.getFullContent(input);
      }),
  }),
  // ... 其他路由
});

export type AppRouter = typeof appRouter;
```

### 5.3 API 版本控制

```typescript
// ✅ 推荐：URL 版本控制
/api/v1/feeds
/api/v1/articles
/api/v2/feeds  // v1 不兼容的变更

// ✅ 推荐：tRPC 命名空间版本
const appRouter = router({
  v1: router({ /* ... */ }),
  v2: router({ /* ... */ }),
});
```

---

## 六、防封号策略规范

### 6.1 核心策略配置

```typescript
// ✅ 推荐：集中管理防封号配置
const ANTI_BAN_CONFIG = {
  // 批次控制
  MAX_FEEDS_PER_BATCH: 3,           // 单批次最大公众号数
  BATCH_INTERVAL_SECONDS: 300,     // 批次间隔（5分钟）

  // 请求频率
  MIN_DELAY_SECONDS: 30,            // 最小延迟
  MAX_DELAY_SECONDS: 120,           // 最大延迟
  DAILY_MAX_REQUESTS: 100,          // 每日最大请求数

  // 重试策略
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY_MULTIPLIER: 5,        // 重试延迟倍数（秒）
};

// ✅ 推荐：User-Agent 轮换
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
  // 至少 5 个不同的 UA
];
```

### 6.2 请求头规范

```typescript
// ✅ 推荐：模拟真实浏览器请求头
const getRequestHeaders = () => ({
  'User-Agent': getRandomUserAgent(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Cache-Control': 'no-cache',
});

// ✅ 推荐：请求间隔随机化
const getRandomDelay = () => {
  const { MIN_DELAY_SECONDS, MAX_DELAY_SECONDS } = ANTI_BAN_CONFIG;
  return Math.floor(
    Math.random() * (MAX_DELAY_SECONDS - MIN_DELAY_SECONDS) + MIN_DELAY_SECONDS
  ) * 1000; // 转换为毫秒
};
```

### 6.3 响应状态监控

```typescript
// ✅ 推荐：响应状态监控与告警
enum ResponseStatus {
  SUCCESS = 200,
  RATE_LIMIT = 429,
  FORBIDDEN = 403,
  SERVER_ERROR = 500,
}

async function handleResponse(response: Response) {
  switch (response.status) {
    case ResponseStatus.SUCCESS:
      return response;
    case ResponseStatus.RATE_LIMIT:
      logger.warn('请求频率限制触发，等待更长时间...');
      await sleep(ANTI_BAN_CONFIG.BATCH_INTERVAL_SECONDS * 1000);
      throw new RateLimitError();
    case ResponseStatus.FORBIDDEN:
      logger.error('IP 或账号被封禁，停止抓取');
      throw new ForbiddenError();
    default:
      throw new UnknownError(response.status);
  }
}
```

---

## 七、测试规范

### 7.1 测试分层

```
┌─────────────────────────────────────────┐
│           测试金字塔                      │
├─────────────────────────────────────────┤
│                                         │
│              E2E 测试                    │
│         (集成测试，端到端)                 │
│           覆盖核心流程                     │
│                                         │
│        ┌─────────────────┐              │
│        │   集成测试       │              │
│        │  (模块间交互)    │              │
│        └────────┬────────┘              │
│                 │                        │
│        ┌────────┴────────┐              │
│        │   单元测试       │              │
│        │ (单个函数/类)    │              │
│        └─────────────────┘              │
│                                         │
└─────────────────────────────────────────┘
```

### 7.2 单元测试规范

```typescript
// ✅ 推荐：单元测试结构
describe('FeedsService', () => {
  let service: FeedsService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FeedsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FeedsService>(FeedsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('findAll', () => {
    it('should return an array of feeds', async () => {
      const expectedFeeds = [{ id: '1', name: 'Test Feed' }];
      mockPrismaService.feed.findMany.mockResolvedValue(expectedFeeds);

      const result = await service.findAll();

      expect(result).toEqual(expectedFeeds);
      expect(prismaService.feed.findMany).toHaveBeenCalled();
    });

    it('should return empty array when no feeds exist', async () => {
      mockPrismaService.feed.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should throw ConflictException if feed already exists', async () => {
      mockPrismaService.feed.findUnique.mockResolvedValue({ id: '1' });

      await expect(service.create({ name: 'Existing' }))
        .rejects.toThrow(ConflictException);
    });
  });
});
```

### 7.3 测试覆盖率要求

| 模块类型 | 最低覆盖率 | 目标覆盖率 |
|---------|-----------|-----------|
| Service | 80% | 90% |
| Controller | 70% | 80% |
| 工具函数 | 90% | 95% |
| 整体项目 | 70% | 80% |

---

## 八、Git 工作流程

### 8.1 分支命名规范

```
main                 # 主分支（生产环境）
├── develop          # 开发分支
├── feature/         # 功能分支
│   ├── feature/article-storage
│   ├── feature/tag-system
│   └── feature/push-notification
├── fix/             # 修复分支
│   ├── fix/rss-format-error
│   └── fix/performance-issue
├── refactor/        # 重构分支
└── docs/           # 文档分支
```

### 8.2 提交信息规范

```
<type>(<scope>): <subject>

[可选 body]

[可选 footer]
```

#### Type 类型

| Type | 说明 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档更新 |
| style | 代码格式（不影响功能） |
| refactor | 重构 |
| perf | 性能优化 |
| test | 测试相关 |
| chore | 构建/工具相关 |

#### 示例

```bash
# ✅ 推荐
git commit -m "feat(feeds): 添加文章内容抓取功能"
git commit -m "fix(articles): 修复 RSS 生成时图片不显示的问题"
git commit -m "docs(readme): 更新项目文档"
git commit -m "refactor(storage): 重构文章存储逻辑，支持压缩存储"
git commit -m "test(feeds): 添加防封号策略单元测试"

# ❌ 避免
git commit -m "fix"
git commit -m "update"
git commit -m "asdf"
git commit -m "WIP"
```

### 8.3 Pull Request 规范

```markdown
## PR 标题
feat(feeds): 添加文章内容抓取功能

## PR 描述

### 功能描述
- 支持抓取微信公众号文章完整内容
- 添加 gzip 压缩存储
- 优化 RSS 生成性能

### 测试结果
- [x] 单元测试通过
- [x] 集成测试通过
- [x] 防封号策略测试通过

### 截图/录屏（如有 UI 变更）

### 相关 Issue
Closes #123
```

### 8.4 Code Review 检查清单

- [ ] 代码符合命名规范
- [ ] 有适当的单元测试
- [ ] 没有明显的性能问题
- [ ] 错误处理完整
- [ ] 日志记录适当
- [ ] 没有敏感信息泄露
- [ ] API 变更已更新文档
- [ ] 数据库迁移可逆

---

## 九、部署规范

### 9.1 环境配置

```bash
# .env.example - 环境变量示例
NODE_ENV=development
DATABASE_URL=file:../data/wewe-rss.db

# 生产环境
NODE_ENV=production
DATABASE_URL=mysql://user:pass@host:3306/wewe_rss
DATABASE_SSL=true

# 抓取配置
CRON_EXPRESSION=0 */6 * * *  # 每6小时执行一次
MAX_FEEDS_PER_BATCH=3
DAILY_MAX_REQUESTS=100

# 推送配置（可选）
PUSH_WEBHOOK_URL=https://hooks.example.com/push
PUSH_API_KEY=your_api_key
```

### 9.2 Docker 部署

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS production

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 9.3 健康检查

```typescript
// ✅ 推荐：添加健康检查端点
@Controller()
export class HealthController {
  @Get('health')
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: await checkDatabaseConnection(),
    };
  }
}
```

---

## 十、数据存储策略

### 10.1 混合存储策略

```typescript
// ✅ 推荐：基于文章年龄的分层存储
enum StorageTier {
  HOT = 'hot',     // 7天内：完整存储 + 缓存
  WARM = 'warm',   // 7-30天：gzip 压缩存储
  COLD = 'cold',   // 30天+：仅存储链接
}

const STORAGE_CONFIG = {
  [StorageTier.HOT]: {
    fullContent: true,
    compressed: false,
    cached: true,
    ttl: 7 * 24 * 60 * 60, // 7天
  },
  [StorageTier.WARM]: {
    fullContent: true,
    compressed: true,
    cached: false,
  },
  [StorageTier.COLD]: {
    fullContent: false,  // 仅保留链接
    compressed: false,
    cached: false,
  },
};
```

### 10.2 数据压缩

```typescript
// ✅ 推荐：gzip 压缩存储
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

async function compressContent(content: string): Promise<Buffer> {
  return await gzipAsync(Buffer.from(content, 'utf8'));
}

async function decompressContent(buffer: Buffer): Promise<string> {
  return (await gunzipAsync(buffer)).toString('utf8');
}
```

---

## 十一、标签系统设计

### 11.1 标签分类

```typescript
// ✅ 推荐：标签分类
enum TagCategory {
  CONTENT = 'content',     // 内容标签：技术、产品、行业趋势等
  CHANNEL = 'channel',     // 渠道标签：公众号名称
  INDUSTRY = 'industry',   // 行业标签：食品、饮料、添加剂等
  SENTIMENT = 'sentiment', // 情感标签：正面、负面、中性
  PRIORITY = 'priority',   // 优先级：高、中、低
}

interface Tag {
  id: string;
  name: string;
  category: TagCategory;
  color: string;           // 用于前端显示
  createdAt: Date;
}

// ✅ 推荐：文章-标签关联
model ArticleTag {
  articleId String @map("article_id")
  tagId     String @map("tag_id")
  createdAt DateTime @default(now()) @map("created_at")

  article   Article @relation(fields: [articleId], references: [id])
  tag       Tag @relation(fields: [tagId], references: [id])

  @@id([articleId, tagId])
  @@map("article_tags")
}
```

### 11.2 自动标签规则

```typescript
// ✅ 推荐：基于内容的自动标签
const AUTO_TAG_RULES = [
  {
    keywords: ['新品', '发布', '上市'],
    tag: '新品发布',
    category: TagCategory.CONTENT,
  },
  {
    keywords: ['配方', '成分', '原料'],
    tag: '产品配方',
    category: TagCategory.CONTENT,
  },
  {
    keywords: ['伊利', '蒙牛', '光明'],
    tag: '龙头企业',
    category: TagCategory.INDUSTRY,
  },
];

function autoTagArticle(content: string): string[] {
  const matchedTags: string[] = [];

  for (const rule of AUTO_TAG_RULES) {
    if (rule.keywords.some(k => content.includes(k))) {
      matchedTags.push(rule.tag);
    }
  }

  return matchedTags;
}
```

---

## 十二、推送系统设计（待开发）

### 12.1 推送内容生成

```typescript
// ✅ 推荐：推送内容结构
interface PushContent {
  title: string;           // 推送标题
  summary: string;         // 归纳总结（100-200字）
  coverImage?: string;     // 配图 URL
  articles: {
    title: string;
    summary: string;
    source: string;
    url: string;
    tags: string[];
  }[];
  generatedAt: Date;
}

// ✅ 推荐：内容归纳算法
async function generateSummary(article: Article): Promise<string> {
  // 1. 提取文章关键段落
  const keyParagraphs = extractKeyParagraphs(article.content);

  // 2. 生成摘要（可调用 LLM API）
  const summary = await llmService.summarize(keyParagraphs, {
    maxLength: 200,
    format: 'bullet',
  });

  return summary;
}
```

### 12.2 推送频率配置

```typescript
// ✅ 推荐：推送配置
const PUSH_SCHEDULE = {
  daily: {
    enabled: true,
    time: '09:00',  // 每天早上9点
    feeds: 'all',
  },
  weekly: {
    enabled: true,
    day: 'monday',
    time: '10:00',
    summary: true,  // 生成周报
  },
};
```

---

## 十三、附录

### 13.1 技术栈版本

| 技术 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 20 | LTS 版本 |
| NestJS | 10.x | 后端框架 |
| Prisma | 5.x | ORM |
| React | 18.x | 前端框架 |
| tRPC | 10.x | API 层 |
| TypeScript | 5.x | 类型系统 |

### 13.2 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
npm run lint             # 代码检查
npm run format           # 代码格式化

# 数据库
npm run migrate          # 创建迁移
npm run migrate:deploy   # 部署迁移
npm run studio            # 打开 Prisma Studio

# 测试
npm run test             # 运行单元测试
npm run test:e2e         # 运行 E2E 测试
npm run test:db          # 运行数据库测试

# 构建
npm run build            # 构建项目
npm run start:prod       # 生产环境启动
```

### 13.3 参考资源

- [NestJS 官方文档](https://docs.nestjs.com)
- [Prisma 官方文档](https://prisma.io/docs)
- [tRPC 官方文档](https://trpc.io)
- [WeChat Public Account Scraping Guidelines](https://developers.weixin.qq.com/doc/offiaccount/Getting_Started/Overview.html)

---

## 十四、规则更新记录

| 版本 | 日期 | 更新内容 | 更新人 |
|------|------|---------|--------|
| v1.0 | 2026-05-17 | 初始版本 | 开发工程师 |

---

> **提示**：本规则文档应随着项目发展持续更新，建议每两周进行一次回顾和优化。
