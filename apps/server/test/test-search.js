const got = require('got');

async function test() {
  const url = 'https://duckduckgo.com/html/?q=配方师Rex+微信公众号+site%3Amp.weixin.qq.com';
  console.log('Testing URL:', url);

  try {
    const response = await got(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    });

    console.log('Response length:', response.body.length);
    const pattern = /https?:\/\/mp\.weixin\.qq\.com\/[^\s<>"']+/g;
    const matches = response.body.match(pattern) || [];
    console.log('WeChat URLs found:', matches.length);
    if (matches.length > 0) {
      console.log('First URL:', matches[0]);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();