const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.article.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      title: true,
      author: true,
      content: true,
      createdAt: true,
    }
  });

  console.log('最近10条抓取记录:');
  console.log('='.repeat(80));

  if (articles.length === 0) {
    console.log('数据库中没有抓取记录');
    return;
  }

  articles.forEach((a, i) => {
    const time = new Date(a.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const title = a.title || '无标题';
    const author = a.author || '未知';
    const length = a.content ? a.content.length : 0;

    console.log(`${i+1}. [${time}] ${title}`);
    console.log(`   作者: ${author} | 内容长度: ${length}`);
  });

  console.log('='.repeat(80));

  const stats = await prisma.article.count();
  console.log(`\n总文章数: ${stats}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
