const got = require('got');
const cheerio = require('cheerio');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min) + min) * 1000;
}

const testArticles = [
  { id: 'lWnrH3_reTtbA1IqB1OPUQ', title: '料到成功，黛莱皙新春快乐', expected: '可能过期' },
  { id: 'GmxZHMcPAfZGVZvdSSbquw', title: '巴斯夫这场STEM活动', expected: '正常' },
  { id: 'gDbvazuTEVpiwtBnjJ4dSA', title: '帝斯曼再获中国最具吸引力雇主', expected: '内容少' },
  { id: 'INVALID_ID_1234567890', title: '伪造的过期链接', expected: '链接不存在' },
  { id: '1tsW7d7Pcm287aBzWtIiUA', title: '喜提集团化药企认定', expected: '内容少' },
  { id: 'ABCDEFGHIJKLMNOPQRST', title: '随机无效字符', expected: '链接不存在' },
  { id: '_0cuMx8RjtkFvOOi0jwqbQ', title: '迎春元宵节钜惠', expected: '可能过期' },
];

async function fetchWithRetry(url, maxRetries = 3) {
  const shuffledAgents = [...USER_AGENTS].sort(() => Math.random() - 0.5);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const userAgent = shuffledAgents[attempt % shuffledAgents.length];
    const delay = getRandomDelay(2, 5);

    console.log(`  🔄 第${attempt + 1}次尝试 (UA: ${userAgent.substring(0, 35)}...)`);

    try {
      const startTime = Date.now();
      const response = await got(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://mp.weixin.qq.com/',
          'Connection': 'keep-alive',
        },
        timeout: { request: 12000 },
      });

      const $ = cheerio.load(response.body);
      const content = $('.rich_media_content').html() || '';
      const contentLength = content.length;
      const responseTime = Date.now() - startTime;

      if (contentLength < 500) {
        console.log(`  ⚠️  内容过少(${contentLength}字节), 准备重试...`);
        if (attempt < maxRetries - 1) {
          console.log(`  ⏳ 等待${delay / 1000}秒后重试...\n`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      return {
        success: true,
        content,
        contentLength,
        responseTime,
        userAgent,
        blocked: contentLength < 500
      };
    } catch (error) {
      console.log(`  ❌ 请求失败: ${error.message}`);

      if (error.response && error.response.statusCode === 404) {
        console.log(`  🔴 链接不存在 (404)`);
        return {
          success: false,
          content: '',
          contentLength: 0,
          responseTime: Date.now() - startTime,
          userAgent,
          errorType: '404_NOT_FOUND'
        };
      }

      if (attempt < maxRetries - 1) {
        const waitTime = delay * (attempt + 1);
        console.log(`  ⏳ 等待${waitTime / 1000}秒后重试...\n`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  return {
    success: false,
    content: '',
    contentLength: 0,
    responseTime: 0,
    userAgent: 'N/A',
    errorType: 'MAX_RETRIES_EXCEEDED'
  };
}

async function runTest() {
  console.log('========================================');
  console.log('📡 过期链接 vs 正常链接 抓取测试');
  console.log('========================================\n');

  let successCount = 0;
  let blockedCount = 0;
  let notFoundCount = 0;
  let failCount = 0;

  for (let i = 0; i < testArticles.length; i++) {
    const article = testArticles[i];
    const url = `https://mp.weixin.qq.com/s/${article.id}`;

    console.log(`\n📄 [${i + 1}/${testArticles.length}] ${article.title}`);
    console.log(`   预期结果: ${article.expected}`);
    console.log(`   URL: ${url}\n`);

    const result = await fetchWithRetry(url);

    if (result.success) {
      if (result.blocked) {
        blockedCount++;
        console.log(`   🔴 被拦截 | ${result.responseTime}ms | ${result.contentLength}字节`);
      } else {
        successCount++;
        const sizeKB = (result.contentLength / 1024).toFixed(1);
        console.log(`   ✅ 成功 | ${result.responseTime}ms | ${sizeKB}KB`);
      }
    } else if (result.errorType === '404_NOT_FOUND') {
      notFoundCount++;
      console.log(`   🔴 404链接不存在`);
    } else {
      failCount++;
      console.log(`   ❌ 最终失败 (${result.errorType || 'unknown'})`);
    }

    if (i < testArticles.length - 1) {
      const delay = getRandomDelay(2, 4);
      console.log(`\n  ⏳ 间隔${delay / 1000}秒...\n`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.log('\n========================================');
  console.log('📊 测试结果汇总');
  console.log('========================================');
  console.log(`  ✅ 成功抓取: ${successCount}`);
  console.log(`  🔴 被拦截: ${blockedCount}`);
  console.log(`  🔴 链接不存在(404): ${notFoundCount}`);
  console.log(`  ❌ 失败: ${failCount}`);
  console.log(`  ─────────────────`);
  console.log(`  总计: ${testArticles.length}`);
  console.log('========================================\n');

  console.log('💡 结论:');
  if (successCount > 0) {
    console.log(`  - ${successCount}篇文章可以正常抓取`);
  }
  if (blockedCount > 0) {
    console.log(`  - ${blockedCount}篇可能被微信反爬拦截(内容<500字节)`);
  }
  if (notFoundCount > 0) {
    console.log(`  - ${notFoundCount}篇是失效链接(已删除或过期)`);
  }
}

runTest().catch(console.error);