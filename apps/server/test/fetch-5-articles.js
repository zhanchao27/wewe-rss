const got = require('got');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class ArticleFetcher {
  constructor() {
    this.requestDelay = 2000;
    this.requestTimeout = 15000;
  }

  async fetchArticle(articleId, index) {
    const articleUrl = `https://mp.weixin.qq.com/s/${articleId}`;

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📄 文章 ${index}: ${articleId}`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`🔗 URL: ${articleUrl}`);

    const startTime = Date.now();

    try {
      const response = await got(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Connection': 'keep-alive'
        },
        timeout: this.requestTimeout
      });

      const html = response.body;
      const $ = cheerio.load(html);

      const title = $('#activity-name').text().trim() || '无标题';
      const author = $('#js_name').text().trim() || '未知作者';

      const publishTimeText = $('#publish_time').text().trim();
      const updateTimeText = $('#app_from_room').text().trim();

      const content = $('.rich_media_content').html() || '';
      const contentText = $('.rich_media_content').text().trim();

      const images = [];
      $('.rich_media_content img').each((i, img) => {
        const src = $(img).attr('src') || $(img).attr('data-src');
        if (src && !src.startsWith('data:')) {
          images.push(src);
        }
      });

      const fetchTime = Date.now() - startTime;

      console.log(`\n✅ 抓取成功! (耗时: ${fetchTime}ms)\n`);

      console.log(`📌 基础信息:`);
      console.log(`   标题: ${title}`);
      console.log(`   作者: ${author}`);
      if (publishTimeText) console.log(`   发布时间: ${publishTimeText}`);
      if (updateTimeText) console.log(`   来源: ${updateTimeText}`);

      console.log(`\n📊 内容统计:`);
      console.log(`   HTML长度: ${content.length.toLocaleString()} 字符 (${(content.length / 1024).toFixed(2)} KB)`);
      console.log(`   纯文本长度: ${contentText.length.toLocaleString()} 字符 (${(contentText.length / 1024).toFixed(2)} KB)`);
      console.log(`   图片数量: ${images.length} 张`);

      if (contentText.length > 0) {
        console.log(`\n📝 内容预览 (前800字符，纯文本):`);
        console.log(`─`.repeat(70));
        const preview = contentText.substring(0, 800);
        console.log(preview);
        console.log(`...`);
        console.log(`─`.repeat(70));
      }

      if (images.length > 0) {
        console.log(`\n🖼️  图片列表 (前3张):`);
        images.slice(0, 3).forEach((img, i) => {
          console.log(`   ${i + 1}. ${img.substring(0, 80)}...`);
        });
        if (images.length > 3) {
          console.log(`   ... 还有 ${images.length - 3} 张图片`);
        }
      }

      return {
        success: true,
        articleId,
        title,
        author,
        content,
        contentText,
        contentLength: content.length,
        images: images.length,
        fetchTime
      };

    } catch (error) {
      const fetchTime = Date.now() - startTime;
      console.log(`\n❌ 抓取失败 (耗时: ${fetchTime}ms)`);
      console.log(`   错误: ${error.message}`);

      return {
        success: false,
        articleId,
        error: error.message,
        fetchTime
      };
    }
  }

  cleanHtmlForStorage(html) {
    const $ = cheerio.load(html);
    const cleaned = $.html($('.rich_media_content'));
    return cleaned
      .replace(/data-src=/g, 'src=')
      .replace(/opacity: 0( !important)?;/g, '')
      .replace(/visibility: hidden;/g, '');
  }

  async saveToFile(results) {
    const outputPath = path.join(__dirname, '../data/fetched-articles.json');

    const report = {
      fetchTime: new Date().toISOString(),
      totalArticles: results.length,
      successCount: results.filter(r => r.success).length,
      failedCount: results.filter(r => !r.success).length,
      articles: results
    };

    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 抓取报告已保存到: ${outputPath}`);

    return outputPath;
  }
}

async function main() {
  const fetcher = new ArticleFetcher();

  console.log(`\n${'█'.repeat(70)}`);
  console.log(`                 文章内容批量抓取测试`);
  console.log(`${'█'.repeat(70)}\n`);

  console.log(`抓取数量: 5 篇文章`);
  console.log(`请求间隔: ${fetcher.requestDelay / 1000} 秒`);
  console.log(`超时时间: ${fetcher.requestTimeout / 1000} 秒`);
  console.log(`\n${'█'.repeat(70)}\n`);

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:../data/wewe-rss.db'
      }
    }
  });

  console.log('📋 从数据库获取5篇文章ID...\n');

  const articles = await prisma.article.findMany({
    take: 5,
    orderBy: { publishTime: 'desc' },
    select: {
      id: true,
      title: true,
      mpId: true,
      publishTime: true
    }
  });

  console.log(`获取到 ${articles.length} 篇文章:\n`);

  articles.forEach((article, index) => {
    const date = new Date(article.publishTime * 1000).toLocaleString('zh-CN');
    console.log(`  ${index + 1}. ${article.title}`);
    console.log(`     ID: ${article.id}`);
    console.log(`     时间: ${date}\n`);
  });

  await prisma.$disconnect();

  console.log(`\n${'█'.repeat(70)}`);
  console.log(`                    开始抓取文章内容`);
  console.log(`${'█'.repeat(70)}\n`);

  const results = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const result = await fetcher.fetchArticle(article.id, i + 1);
    results.push(result);

    if (i < articles.length - 1) {
      console.log(`\n⏳ 等待 ${fetcher.requestDelay / 1000} 秒后继续...\n`);
      await new Promise(resolve => setTimeout(resolve, fetcher.requestDelay));
    }
  }

  console.log(`\n${'█'.repeat(70)}`);
  console.log(`                      抓取结果汇总`);
  console.log(`${'█'.repeat(70)}\n`);

  const successResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);

  console.log(`📊 总体统计:`);
  console.log(`   总计: ${results.length} 篇`);
  console.log(`   成功: ${successResults.length} 篇`);
  console.log(`   失败: ${failedResults.length} 篇\n`);

  if (successResults.length > 0) {
    const totalContentSize = successResults.reduce((sum, r) => sum + r.contentLength, 0);
    const avgContentSize = totalContentSize / successResults.length;
    const totalFetchTime = successResults.reduce((sum, r) => sum + r.fetchTime, 0);
    const avgFetchTime = totalFetchTime / successResults.length;
    const totalImages = successResults.reduce((sum, r) => sum + r.images, 0);

    console.log(`📈 成功抓取的文章统计:`);
    console.log(`   总内容大小: ${(totalContentSize / 1024).toFixed(2)} KB`);
    console.log(`   平均内容大小: ${(avgContentSize / 1024).toFixed(2)} KB`);
    console.log(`   总抓取耗时: ${(totalFetchTime / 1000).toFixed(2)} 秒`);
    console.log(`   平均抓取耗时: ${avgFetchTime.toFixed(0)} ms`);
    console.log(`   总图片数量: ${totalImages} 张`);
    console.log(`   平均图片数量: ${(totalImages / successResults.length).toFixed(1)} 张/篇\n`);

    console.log(`✅ 成功抓取的文章:\n`);
    successResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
      console.log(`     内容: ${result.contentLength.toLocaleString()} 字符 | 图片: ${result.images}张 | 耗时: ${result.fetchTime}ms\n`);
    });
  }

  if (failedResults.length > 0) {
    console.log(`❌ 抓取失败的文章:\n`);
    failedResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.articleId}`);
      console.log(`     错误: ${result.error}\n`);
    });
  }

  const outputPath = await fetcher.saveToFile(results);

  console.log(`\n${'█'.repeat(70)}\n`);

  console.log(`💡 结论:\n`);

  if (successResults.length === results.length) {
    console.log(`✅ 所有文章抓取成功!`);
    console.log(`   - 系统可以正常访问微信文章`);
    console.log(`   - 内容完整性良好 (平均 ${(avgContentSize / 1024).toFixed(1)} KB/篇)`);
    console.log(`   - 可以作为 fulltext 存储的数据源\n`);
  } else if (successResults.length > 0) {
    console.log(`⚠️  部分文章抓取失败`);
    console.log(`   - 成功率: ${((successResults.length / results.length) * 100).toFixed(0)}%`);
    console.log(`   - 可能是网络问题或文章已删除\n`);
  } else {
    console.log(`❌ 全部文章抓取失败`);
    console.log(`   - 请检查网络连接`);
    console.log(`   - 可能是微信反爬机制\n`);
  }

  console.log(`${'█'.repeat(70)}\n`);
}

main().catch(console.error);
