const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'file:../data/wewe-rss.db' } }
});

async function main() {
  const feeds = await prisma.feed.findMany({
    select: { id: true, mpName: true, status: true }
  });

  console.log('当前订阅源数量:', feeds.length);
  feeds.forEach(f => {
    console.log(`${f.id} | ${f.mpName} | ${f.status === 1 ? '✅' : '❌'}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);