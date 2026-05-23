# 方案 B：开启全文存储 - 代码对比

## 📋 当前代码 vs 修改后代码

---

## 1. 核心文件：`src/trpc/trpc.service.ts`

### 📌 当前代码（第 174-220 行）

```typescript
async refreshMpArticlesAndUpdateFeed(mpId: string, page = 1) {
  const articles = await this.getMpArticles(mpId, page);

  if (articles.length > 0) {
    let results;
    const { type } = this.configService.get<ConfigurationType['database']>('database')!;
    if (type === 'sqlite') {
      // sqlite3 不支持 createMany
      const inserts = articles.map(({ id, picUrl, publishTime, title }) =>
        this.prismaService.article.upsert({
          create: { id, mpId, picUrl, publishTime, title },
          update: { publishTime, title },
          where: { id },
        }),
      );
      results = await this.prismaService.$transaction(inserts);
    } else {
      results = await (this.prismaService.article as any).createMany({
        data: articles.map(({ id, picUrl, publishTime, title }) => ({
          id, mpId, picUrl, publishTime, title,
        })),
        skipDuplicates: true,
      });
    }
    this.logger.debug(`refreshMpArticlesAndUpdateFeed create results: ${JSON.stringify(results)}`);
  }

  const hasHistory = articles.length < defaultCount ? 0 : 1;
  await this.prismaService.feed.update({
    where: { id: mpId },
    data: { syncTime: Math.floor(Date.now() / 1e3), hasHistory },
  });

  return { hasHistory };
}
```

### 📌 修改后代码

```typescript
async refreshMpArticlesAndUpdateFeed(mpId: string, page = 1) {
  const articles = await this.getMpArticles(mpId, page);

  if (articles.length > 0) {
    // ============================================
    // 【新增】批量抓取文章全文
    // ============================================
    const articlesWithContent = await this.fetchArticlesContent(articles);

    let results;
    const { type } = this.configService.get<ConfigurationType['database']>('database')!;
    if (type === 'sqlite') {
      const inserts = articlesWithContent.map(
        ({ id, picUrl, publishTime, title, content, author, url }) =>
          this.prismaService.article.upsert({
            create: { id, mpId, picUrl, publishTime, title, content, author, url },
            update: { publishTime, title, content, author, url },
            where: { id },
          }),
      );
      results = await this.prismaService.$transaction(inserts);
    } else {
      results = await (this.prismaService.article as any).createMany({
        data: articlesWithContent.map(({ id, picUrl, publishTime, title, content, author, url }) => ({
          id, mpId, picUrl, publishTime, title, content, author, url,
        })),
        skipDuplicates: true,
      });
    }
    this.logger.debug(`refreshMpArticlesAndUpdateFeed create results: ${JSON.stringify(results)}`);
  }

  const hasHistory = articles.length < defaultCount ? 0 : 1;
  await this.prismaService.feed.update({
    where: { id: mpId },
    data: { syncTime: Math.floor(Date.now() / 1e3), hasHistory },
  });

  return { hasHistory };
}

// ============================================
// 【新增】批量抓取文章全文的方法
// ============================================
private async fetchArticlesContent(articles: Array<{
  id: string;
  title: string;
  picUrl: string;
  publishTime: number;
}>): Promise<Array<{
  id: string;
  title: string;
  picUrl: string;
  publishTime: number;
  content: string;
  author: string;
  url: string;
}>> {
  const results = [];
  const delay = this.configService.get<ConfigurationType['feed']>('feed')!.updateDelayTime;

  for (const article of articles) {
    try {
      // 访问文章详情页抓取全文
      const articleDetail = await this.getArticleDetail(article.id);
      results.push({
        ...article,
        content: articleDetail.content || '',
        author: articleDetail.author || '',
        url: `https://mp.weixin.qq.com/s/${article.id}`,
      });

      // 防封号延迟
      await new Promise((resolve) => setTimeout(resolve, delay * 1e3));

    } catch (error) {
      this.logger.warn(`抓取文章 ${article.id} 全文失败: ${error.message}`);
      results.push({
        ...article,
        content: '',
        author: '',
        url: `https://mp.weixin.qq.com/s/${article.id}`,
      });
    }
  }

  return results;
}

// ============================================
// 【新增】获取单篇文章详情
// ============================================
private async getArticleDetail(articleId: string): Promise<{
  content: string;
  author: string;
}> {
  const account = await this.getAvailableAccount();

  try {
    const response = await this.request.get(
      `/api/v2/platform/articles/${articleId}`,
      {
        headers: {
          xid: account.id,
          Authorization: `Bearer ${account.token}`,
        },
      }
    );

    return {
      content: response.data.content || '',
      author: response.data.author || '',
    };
  } catch (error) {
    // 如果API失败，尝试直接抓取网页
    return this.fetchArticleFromWeb(articleId);
  }
}

// ============================================
// 【新增】直接从网页抓取文章内容（备用方案）
// ============================================
private async fetchArticleFromWeb(articleId: string): Promise<{
  content: string;
  author: string;
}> {
  const got = require('got');
  const cheerio = require('cheerio');

  try {
    const articleUrl = `https://mp.weixin.qq.com/s/${articleId}`;
    const response = await got(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
      timeout: { request: 30000 },
    });

    const $ = cheerio.load(response.body);
    const content = $('.rich_media_content').html() || '';
    const author = $('#js_name').text().trim() || '';

    return { content, author };
  } catch (error) {
    this.logger.warn(`网页抓取文章 ${articleId} 失败: ${error.message}`);
    return { content: '', author: '' };
  }
}
```

---

## 2. 存储字段对比

| 字段 | 当前代码 | 修改后 |
|------|---------|--------|
| id | ✅ 保存 | ✅ 保存 |
| mpId | ✅ 保存 | ✅ 保存 |
| title | ✅ 保存 | ✅ 保存 |
| picUrl | ✅ 保存 | ✅ 保存 |
| publishTime | ✅ 保存 | ✅ 保存 |
| **content** | ❌ 不保存 | ✅ 保存 |
| **author** | ❌ 不保存 | ✅ 保存 |
| **url** | ❌ 不保存 | ✅ 保存 |

---

## 3. 对现有功能的影响分析

### ✅ 不受影响的功能

| 功能 | 原因 |
|------|------|
| RSS Feed 生成 | Article.content 现在有值，RSS 会包含完整内容 |
| 文章列表查询 | 只查询元数据，不受影响 |
| 定时抓取调度 | 接口不变，只是内部逻辑增强 |
| 账号管理 | 完全不受影响 |
| Feed 更新 | 只是多了字段，不影响流程 |

### ⚠️ 需要注意的变化

| 变化项 | 影响 | 处理方式 |
|--------|------|---------|
| 抓取时间增加 | 每篇文章多 800ms-1.5s | 已配置 delay 延迟 |
| 数据库存储增加 | 约 50KB/篇 | 预估 217篇 ≈ 10MB |
| API 调用次数增加 | 2倍（列表+详情） | 使用延迟 + 防封策略 |

---

## 4. 配置建议

```typescript
// 在 configuration.ts 中添加
fullTextStorage: {
  enabled: true,           // 开启全文存储
  delayMs: 1000,          // 抓取间隔 1 秒
  batchSize: 5,           // 每批处理 5 篇
  batchDelayMs: 30000,    // 批次间隔 30 秒
}
```

---

## 5. 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| 封号风险 | 🟡 中等 | 添加随机延迟 + UA 轮换 |
| 抓取失败 | 🟢 低 | 失败时保存空内容，不阻塞流程 |
| 存储溢出 | 🟢 低 | 当前 217 篇仅约 10MB |
| 性能下降 | 🟢 低 | 增加约 3-5 分钟/批次 |

---

## 6. 实施步骤

1. **第一步**：备份当前代码
2. **第二步**：添加新的辅助方法（fetchArticlesContent, getArticleDetail, fetchArticleFromWeb）
3. **第三步**：修改 refreshMpArticlesAndUpdateFeed 方法
4. **第四步**：测试单公众号抓取
5. **第五步**：观察 24 小时稳定性
6. **第六步**：全量开启

---

## ❓ 确认事项

请确认以下问题后再实施：

1. **是否接受抓取时间增加？**
   - 当前：约 10 分钟/批次（10 个公众号）
   - 修改后：约 20-30 分钟/批次

2. **是否接受存储空间增加？**
   - 当前：约 217 × 500 字节 ≈ 100KB
   - 修改后：约 217 × 50KB ≈ 10MB

3. **是否需要保留备用方案？**
   - 如果 API 不可用，自动切换到网页抓取
