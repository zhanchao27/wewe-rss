const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../data/wewe-rss.db'
    }
  }
});

async function checkArticleContent() {
  console.log('=== Article 表内容完整性分析 ===\n');

  try {
    console.log('1. 统计 Article 表整体情况...\n');

    const totalCount = await prisma.article.count();
    console.log(`   总记录数: ${totalCount}`);

    const articles = await prisma.article.findMany({
      take: 5,
      orderBy: { publishTime: 'desc' }
    });

    console.log('\n2. 查看最近5篇文章的字段填充情况...\n');

    articles.forEach((article, idx) => {
      console.log(`   文章 ${idx + 1}: ${article.title.substring(0, 40)}...`);
      console.log(`     ├─ id: ${article.id}`);
      console.log(`     ├─ mpId: ${article.mpId}`);
      console.log(`     ├─ title: ${article.title ? '✓ 有 (' + article.title.length + '字符)' : '✗ 无'}`);
      console.log(`     ├─ picUrl: ${article.picUrl ? '✓ 有' : '✗ 无'}`);
      console.log(`     ├─ publishTime: ${new Date(article.publishTime * 1000).toLocaleString()}`);
      console.log(`     ├─ content: ${article.content ? '✓ 有 (' + article.content.length + '字符)' : '✗ 无 (NULL)'}`);
      console.log(`     ├─ author: ${article.author ? article.author : '✗ 无 (NULL)'}`);
      console.log(`     ├─ url: ${article.url ? article.url.substring(0, 50) + '...' : '✗ 无 (NULL)'}`);
      console.log(`     ├─ status: ${article.status}`);
      console.log(`     └─ qualityScore: ${article.qualityScore}`);
      console.log('');
    });

    console.log('3. 统计 content 字段非空比例...\n');

    const withContent = await prisma.article.count({
      where: {
        content: {
          not: null
        }
      }
    });

    const withUrl = await prisma.article.count({
      where: {
        url: {
          not: null
        }
      }
    });

    const withAuthor = await prisma.article.count({
      where: {
        author: {
          not: null
        }
      }
    });

    console.log(`   ├─ content 非空: ${withContent}/${totalCount} (${((withContent/totalCount)*100).toFixed(1)}%)`);
    console.log(`   ├─ url 非空: ${withUrl}/${totalCount} (${((withUrl/totalCount)*100).toFixed(1)}%)`);
    console.log(`   └─ author 非空: ${withAuthor}/${totalCount} (${((withAuthor/totalCount)*100).toFixed(1)}%)`);

    console.log('\n4. 查看一条有 content 的文章示例...\n');

    const articleWithContent = await prisma.article.findFirst({
      where: {
        content: {
          not: null
        }
      }
    });

    if (articleWithContent) {
      console.log(`   标题: ${articleWithContent.title}`);
      console.log(`   Content长度: ${articleWithContent.content.length} 字符`);
      console.log(`   Content预览 (前200字符):`);
      console.log('   ' + '─'.repeat(70));
      console.log('   ' + articleWithContent.content.substring(0, 200).replace(/\n/g, '\n   '));
      console.log('   ' + '─'.repeat(70));
    } else {
      console.log('   (没有找到包含完整内容的文章)');
    }

    console.log('\n=== 结论 ===\n');

    if (withContent > 0) {
      console.log('✅ Article 表设计为存储文章完整内容');
      console.log(`   - ${((withContent/totalCount)*100).toFixed(1)}% 的文章包含完整正文内容`);
      console.log('   - 字段 content 用于存储 HTML 格式的文章正文');
      console.log('   - 字段 url 存储原文链接 (微信文章地址)');
      console.log('   - 字段 author 存储文章作者');
      console.log('   - 字段 qualityScore 评估内容质量\n');
    } else {
      console.log('⚠️  Article 表目前主要存储链接等基本信息');
      console.log('   - content 字段为空，未抓取完整正文');
      console.log('   - url 字段有值，可跳转至微信原文');
      console.log('   - 如需全文内容，需要启用内容抓取功能\n');
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkArticleContent();
