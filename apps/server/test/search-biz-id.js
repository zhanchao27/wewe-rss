const got = require('got');

const OFFICIAL_ACCOUNTS = [
  '配方师Rex',
  '妆妍会',
  '硅碳鼠日化圈',
  '美浪CBEAUTY',
  '个护前沿',
  '肤子堂',
  'Fbeauty未来迹',
  '基础颜究',
  '美妆小报',
  '美妆产品观',
  '荣格个人护理',
  '真魅博客truebuty',
  '美丽修行App',
  '言之有物',
  '三亩叔',
  'PCHi',
  '青眼',
  '聚美丽',
  '中国化妆品',
  '化妆品观察品观',
  '成分控',
  '美妆前沿研究',
  'i美妆头条',
  '辉文生物HUIWEN_BIOLOGY',
  '唯铂莱生物科技',
  '克琴实验室',
  'JLand聚源生物',
  '瑞吉明生物',
  '维琪Winkey',
  '巴斯夫护理化学品',
  '德之馨化妆品技术与科学',
  '赢创个人护理',
  '瓦克化学中国',
  '帝斯曼芬美意Beauty&Care',
  '亚什兰个人护理',
  '路博润配方自信无限',
  '森馨化妆品科技',
  '嘉法狮',
  '仙婷创新实验室',
  '科莱恩中国',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

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

async function searchWithDuckDuckGo(accountName) {
  const searchQuery = encodeURIComponent(`${accountName} 微信公众号`);
  const searchUrl = `https://duckduckgo.com/html/?q=${searchQuery}+site%3Amp.weixin.qq.com`;

  try {
    const response = await got(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 15000,
    });

    const body = response.body;
    const bizIdSet = new Set();
    const urlPattern = /https?:\/\/mp\.weixin\.qq\.com\/[^\s<>"]+/g;
    const urls = body.match(urlPattern) || [];

    for (const url of urls) {
      const bizId = extractBizId(url);
      if (bizId) {
        bizIdSet.add(bizId);
      }
    }

    return {
      name: accountName,
      found: bizIdSet.size > 0,
      bizIds: Array.from(bizIdSet),
      sampleUrl: urls[0] || null,
    };
  } catch (error) {
    return {
      name: accountName,
      found: false,
      bizIds: [],
      error: error.message,
    };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       微信公众号 biz_id 批量搜索工具 (DuckDuckGo)           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`待搜索公众号数量: ${OFFICIAL_ACCOUNTS.length}\n`);

  const results = [];
  let foundCount = 0;

  for (let i = 0; i < OFFICIAL_ACCOUNTS.length; i++) {
    const name = OFFICIAL_ACCOUNTS[i];
    process.stdout.write(`[${i + 1}/${OFFICIAL_ACCOUNTS.length}] 搜索: ${name} ... `);

    const result = await searchWithDuckDuckGo(name);
    results.push(result);

    if (result.found) {
      foundCount++;
      console.log(`✅ bizId: ${result.bizIds[0]}`);
    } else if (result.error) {
      console.log(`❌ 错误: ${result.error}`);
    } else {
      console.log(`❌ 未找到`);
    }

    if (i < OFFICIAL_ACCOUNTS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('搜索结果汇总');
  console.log('='.repeat(70));

  console.log(`\n✅ 成功找到: ${foundCount}/${OFFICIAL_ACCOUNTS.length}\n`);

  const foundAccounts = results.filter(r => r.found);
  const notFoundAccounts = results.filter(r => !r.found);

  if (foundAccounts.length > 0) {
    console.log('已找到的公众号:\n');
    for (const r of foundAccounts) {
      console.log(`  ${r.name}`);
      console.log(`    biz_id: ${r.bizIds[0]}`);
      console.log('');
    }
  }

  if (notFoundAccounts.length > 0) {
    console.log(`\n❌ 未找到 (${notFoundAccounts.length}个):\n`);
    for (const r of notFoundAccounts) {
      console.log(`  - ${r.name}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('SQL 插入语句');
  console.log('='.repeat(70));
  console.log('\n-- 复制以下SQL到数据库执行:\n');

  for (const r of foundAccounts) {
    const bizId = r.bizIds[0];
    const safeName = r.name.replace(/'/g, "''");
    console.log(`INSERT INTO feeds (id, "mpName", "mpCover", "mpIntro", status, "syncTime", "updateTime", "hasHistory")`);
    console.log(`VALUES ('MP_WXS_${bizId}', '${safeName}', '', '', 1, ${Date.now()}, ${Date.now()}, 1);\n`);
  }
}

main().catch(console.error);