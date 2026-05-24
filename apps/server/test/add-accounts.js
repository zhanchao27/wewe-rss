const got = require('got');
const { PrismaClient } = require('@prisma/client');

const ACCOUNTS = [
  { name: '配方师Rex', url: 'https://mp.weixin.qq.com/s/hrIQgQJ4btznk7LMWQJIIA' },
  { name: '妆妍会', url: 'https://mp.weixin.qq.com/s/BeArK_D3AVT8b2NZJ12ikw' },
  { name: '硅碳鼠日化圈', url: 'https://mp.weixin.qq.com/s/UJTQFI8ImWpAzT7YP_BpUA' },
  { name: '美浪CBEAUTY', url: 'https://mp.weixin.qq.com/s/wg9XzVOlKQiQd0CzGKj_cw' },
  { name: '个护前沿', url: 'https://mp.weixin.qq.com/s/KpF4X86b-I7rzAvWWslpcA' },
  { name: '肤子堂', url: 'https://mp.weixin.qq.com/s/HGHlG1eFZ1B7zLE2hZ0FiA' },
  { name: 'Fbeauty未来迹', url: 'https://mp.weixin.qq.com/s/dxF5gzxA6sTcf8gBCGCoPQ' },
  { name: '基础颜究', url: 'https://mp.weixin.qq.com/s/TUHLNLIfkpwiNQA4IYf_-g' },
  { name: '美妆小报', url: 'https://mp.weixin.qq.com/s/5PKaX4wXKlAC99tLmqO92Q' },
  { name: '美妆产品观', url: 'https://mp.weixin.qq.com/s/H-5ROXDDssYQF1tWrGD0Dw' },
  { name: '荣格个人护理', url: 'https://mp.weixin.qq.com/s/_gXesW5Fwr6U8--Pubtzsg' },
  { name: '真魅博客truebuty', url: 'https://mp.weixin.qq.com/s/ysIB-lB4TR3J9NvD8KkaSg' },
  { name: '美丽修行App', url: 'https://mp.weixin.qq.com/s/kF-_WP6q74cm1VxHhZwtLA' },
  { name: 'diary言之有物', url: 'https://mp.weixin.qq.com/s/AeXEiIVWyIvzQoA3ow9Exw' },
  { name: '三亩叔', url: 'https://mp.weixin.qq.com/s/5aLwT0zLaL7KV7secIjKjw' },
  { name: 'PCHi', url: 'https://mp.weixin.qq.com/s/lEx6NJrJtUe5BLLtnwdD1A' },
  { name: '青眼', url: 'https://mp.weixin.qq.com/s/BBaQvFbseWFgCL8C08ZVmA' },
  { name: '聚美丽', url: 'https://mp.weixin.qq.com/s/G5mAWGk8lq_HjHWaSTT2Lw' },
  { name: '中国化妆品', url: 'https://mp.weixin.qq.com/s/OIGrhOdrKFBFZS3kbID61Q' },
  { name: '化妆品观察品观', url: 'https://mp.weixin.qq.com/s/ZZyXlqRfXbfkYarHAHMNsg' },
  { name: '成分控', url: 'https://mp.weixin.qq.com/s/7UHj2cZ7BtrxfX6f87Bl1g' },
  { name: '美妆前沿研究', url: 'https://mp.weixin.qq.com/s/33DkvQJMlxCFLBiz6Bi4PQ' },
  { name: 'i美妆头条', url: 'https://mp.weixin.qq.com/s/bEeoBuMhdSrmjXQGqPjL4A' },
  { name: '辉文生物HUIWEN_BIOLOGY', url: 'https://mp.weixin.qq.com/s/GyR1vmGZeMgD-Icz3xrABw' },
  { name: '唯铂莱生物科技', url: 'https://mp.weixin.qq.com/s/heu622CkE5BJP6wukpLGkw' },
  { name: '克琴实验室', url: 'https://mp.weixin.qq.com/s/yJ-_DWfI99pBabdX0BIJhA' },
  { name: 'JLand聚源生物', url: 'https://mp.weixin.qq.com/s/mYfoA9ztXpnw2Od1psVNuw' },
  { name: '瑞吉明生物', url: 'https://mp.weixin.qq.com/s/cd9xoO1zl-avDAoqUALY_w' },
  { name: '维琪Winkey', url: 'https://mp.weixin.qq.com/s/wmYf55UdyBdDoNy2oZQTzA' },
  { name: '巴斯夫护理化学品', url: 'https://mp.weixin.qq.com/s/tFMefBgdiGko-epjmHpnaQ' },
  { name: '德之馨化妆品技术与科学', url: 'https://mp.weixin.qq.com/s/PEf_QFBU_CcnxT0Wb98Fhg' },
  { name: '赢创个人护理', url: 'https://mp.weixin.qq.com/s/bSYmsJ9bV-AOAQw8eXM6pA' },
  { name: '瓦克化学中国', url: 'https://mp.weixin.qq.com/s/HtKqCYcui0Wc4yF2ckpmrQ' },
  { name: '帝斯曼芬美意Beauty&Care', url: 'https://mp.weixin.qq.com/s/jUJR_Bl4utzcXvIm_xQw6w' },
  { name: '亚什兰个人护理', url: 'https://mp.weixin.qq.com/s/yWqWFKMk6txkx4fw0sj2Mw' },
  { name: '路博润配方自信无限', url: 'https://mp.weixin.qq.com/s/NCETT7FdEUIWcvlQzhDq7w' },
  { name: '森馨化妆品科技', url: 'https://mp.weixin.qq.com/s/bkmIRvoxV659jWmcPyMr2g' },
  { name: '嘉法狮', url: 'https://mp.weixin.qq.com/s/tEoxkOrmdgpcoxceHS8c5Q' },
  { name: '仙婷创新实验室', url: 'https://mp.weixin.qq.com/s/R8mRTGHPt6Yz_Ggrcs-iTA' },
  { name: '科莱恩中国', url: 'https://mp.weixin.qq.com/s/bEh1bzWmWVZnzSQp9M3oVA' },
];

function extractBizId(url) {
  const bizMatch = url.match(/__biz=([A-Za-z0-9+/=]+)/);
  if (bizMatch) {
    return bizMatch[1];
  }

  const mpMatch = url.match(/mp\.weixin\.qq\.com\/s\/([A-Za-z0-9_-]+)/);
  if (mpMatch) {
    return mpMatch[1];
  }

  return null;
}

async function fetchBizIdFromUrl(url) {
  try {
    const response = await got(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10000,
    });

    const body = response.body;
    const bizMatch = body.match(/var\s+biz\s*=\s*["']([A-Za-z0-9+/=]+)["']/);
    if (bizMatch) {
      return bizMatch[1];
    }

    const bizInputMatch = body.match(/name\s*=\s*["']biz["']\s+value\s*=\s*["']([A-Za-z0-9+/=]+)["']/i);
    if (bizInputMatch) {
      return bizInputMatch[1];
    }

    return null;
  } catch (error) {
    console.error(`Fetch error for ${url}: ${error.message}`);
    return null;
  }
}

async function addFeedsToDatabase() {
  const prisma = new PrismaClient({
    datasources: { db: { url: 'file:../data/wewe-rss.db' } }
  });

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       批量添加微信公众号订阅源                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let addedCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const account of ACCOUNTS) {
    const bizId = extractBizId(account.url);

    if (!bizId) {
      console.log(`[${ACCOUNTS.indexOf(account) + 1}/${ACCOUNTS.length}] ⏭️  跳过 ${account.name}: 无法从URL提取biz_id`);
      continue;
    }

    const feedId = `MP_WXS_${bizId}`;

    try {
      const existing = await prisma.feed.findUnique({
        where: { id: feedId }
      });

      if (existing) {
        console.log(`[${ACCOUNTS.indexOf(account) + 1}/${ACCOUNTS.length}] ⏭️  跳过 ${account.name}: 已存在`);
        skipCount++;
        continue;
      }

      const now = Math.floor(Date.now() / 1000);
      const feed = await prisma.feed.create({
        data: {
          id: feedId,
          mpName: account.name,
          mpCover: '',
          mpIntro: '',
          status: 1,
          syncTime: now,
          updateTime: now,
          hasHistory: 1
        }
      });

      console.log(`[${ACCOUNTS.indexOf(account) + 1}/${ACCOUNTS.length}] ✅ 添加 ${account.name}`);
      console.log(`    biz_id: ${bizId}`);
      addedCount++;
    } catch (error) {
      console.error(`[${ACCOUNTS.indexOf(account) + 1}/${ACCOUNTS.length}] ❌ 错误 ${account.name}: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('添加完成');
  console.log('='.repeat(60));
  console.log(`✅ 新增: ${addedCount}`);
  console.log(`⏭️  跳过: ${skipCount}`);
  console.log(`❌ 错误: ${errorCount}`);
  console.log(`📊 总计: ${ACCOUNTS.length}`);

  const totalFeeds = await prisma.feed.count();
  console.log(`\n📦 数据库订阅源总数: ${totalFeeds}`);

  await prisma.$disconnect();
}

addFeedsToDatabase().catch(console.error);