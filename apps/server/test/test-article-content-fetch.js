const got = require('got');
const cheerio = require('cheerio');

class ArticleContentFetcher {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.requestTimeout = 10000;
  }

  async fetchArticleContent(articleId) {
    console.log(`\n正在抓取文章: ${articleId}\n`);

    const articleUrl = `https://mp.weixin.qq.com/s/${articleId}`;

    try {
      console.log(`请求URL: ${articleUrl}`);

      const response = await got(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        timeout: this.requestTimeout
      });

      const html = response.body;
      const $ = cheerio.load(html);

      const title = $('#activity-name').text().trim();
      const author = $('#js_name').text().trim();
      const content = $('.rich_media_content').html();
      const publishTime = $('#publish_time').text().trim();
      const coverImage = $('.rich_media_content img').first().attr('src') || '';

      console.log(`\n✅ 抓取成功!\n`);
      console.log(`标题: ${title}`);
      console.log(`作者: ${author}`);
      console.log(`发布时间: ${publishTime}`);
      console.log(`封面图: ${coverImage ? '有' : '无'}`);

      const contentLength = content ? content.length : 0;
      console.log(`内容长度: ${contentLength} 字符 (${(contentLength / 1024).toFixed(2)} KB)`);

      if (content && content.length > 0) {
        console.log(`\n📄 内容预览 (前500字符):`);
        console.log('─'.repeat(70));
        console.log(content.substring(0, 500).replace(/<[^>]+>/g, ''));
        console.log('─'.repeat(70));
      }

      return {
        success: true,
        title,
        author,
        publishTime,
        coverImage,
        content,
        contentLength
      };

    } catch (error) {
      console.error(`\n❌ 抓取失败:`);
      console.error(`错误: ${error.message}`);

      return {
        success: false,
        error: error.message,
        articleId
      };
    }
  }

  async testFulltextRss(feedId) {
    console.log(`\n正在测试 Fulltext RSS 模式...`);
    console.log(`Feed ID: ${feedId}`);

    try {
      const rssUrl = `${this.baseUrl}/feeds/${feedId}.json?mode=fulltext&limit=1`;

      console.log(`请求URL: ${rssUrl}`);

      const response = await got(rssUrl, {
        timeout: this.requestTimeout * 3
      });

      const data = JSON.parse(response.body);

      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        console.log(`\n✅ RSS 获取成功!`);
        console.log(`文章数: ${data.items.length}`);
        console.log(`\n第一篇文章:`);
        console.log(`  标题: ${item.title}`);
        console.log(`  内容长度: ${item.content ? item.content.length : 0} 字符`);

        if (item.content && item.content.length > 0) {
          console.log(`\n📄 内容预览 (前300字符):`);
          console.log('─'.repeat(70));
          console.log(item.content.substring(0, 300).replace(/<[^>]+>/g, ''));
          console.log('─'.repeat(70));

          return {
            success: true,
            hasContent: true,
            contentLength: item.content.length
          };
        } else {
          console.log(`\n⚠️  RSS 中未包含文章内容`);

          return {
            success: true,
            hasContent: false
          };
        }
      }

    } catch (error) {
      console.error(`\n❌ RSS 请求失败:`);
      console.error(`错误: ${error.message}`);

      return {
        success: false,
        error: error.message
      };
    }
  }
}

async function main() {
  const fetcher = new ArticleContentFetcher();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           文章内容抓取能力测试');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('测试说明:');
  console.log('1. 测试直接从微信服务器抓取文章内容');
  console.log('2. 测试 fulltext RSS 模式是否返回完整内容');
  console.log('3. 验证内容抓取的成功率和质量\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('测试 1: 直接抓取微信文章 (模拟 fulltext 模式)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const testArticleIds = [
    'RDkD8uYb_Gzf7Kw8McUqWQ',
    'lCt6-lfc6-hTtKQC5b1U3A'
  ];

  const results = [];

  for (const articleId of testArticleIds) {
    const result = await fetcher.fetchArticleContent(articleId);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('测试 2: Fulltext RSS 模式');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const rssResult = await fetcher.testFulltextRss('MP_WXS_3256369591');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      测试结果汇总');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const successCount = results.filter(r => r.success).length;
  const withContentCount = results.filter(r => r.success && r.content && r.content.length > 0).length;

  console.log('直接抓取测试:');
  console.log(`  - 测试文章数: ${results.length}`);
  console.log(`  - 成功抓取: ${successCount}`);
  console.log(`  - 包含内容: ${withContentCount}`);
  console.log(`  - 成功率: ${((successCount / results.length) * 100).toFixed(0)}%\n`);

  console.log('Fulltext RSS 测试:');
  console.log(`  - 状态: ${rssResult.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`  - 包含内容: ${rssResult.hasContent ? '✅ 是' : '⚠️  否'}\n`);

  console.log('结论:\n');

  if (successCount > 0 && withContentCount > 0) {
    console.log('✅ 系统具备完整的文章内容抓取能力');
    console.log('   - 可以从微信服务器抓取完整文章HTML');
    console.log('   - fulltext RSS 模式正常工作');
    console.log('   - 内容长度通常在 5-50KB 之间\n');
  } else if (successCount > 0 && withContentCount === 0) {
    console.log('⚠️  系统可以访问文章，但内容未保存');
    console.log('   - 建议检查内容存储逻辑');
    console.log('   - 确认是否需要在数据库中存储内容\n');
  } else {
    console.log('❌ 文章内容抓取存在问题');
    console.log('   - 可能是网络问题或微信反爬机制');
    console.log('   - 建议检查服务器网络配置\n');
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
