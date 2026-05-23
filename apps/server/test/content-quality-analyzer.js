/**
 * 内容质量分析服务
 *
 * 功能：
 * 1. 检测纯图片/视频内容
 * 2. 计算内容质量分数
 * 3. 标记需要人工审核的内容
 *
 * 使用方式：
 *   const analyzer = new ContentQualityAnalyzer();
 *   const quality = analyzer.analyze(htmlContent, title);
 *   console.log(quality);
 */

const cheerio = require('cheerio');

class ContentQualityAnalyzer {
  constructor() {
    this.defaultOptions = {
      minTextRatio: 0.05,
      maxImageRatio: 0.9,
      emptyContentLength: 100,
    };
  }

  analyze(html, title = '', options) {
    const opts = { ...this.defaultOptions, ...options };
    const flags = [];

    if (!html || html.trim() === '') {
      return this.createEmptyResult('empty_content');
    }

    const $ = cheerio.load(html);
    const htmlLength = html.length;

    const text = this.extractText($);
    const textLength = text.trim().length;

    const imageCount = this.countImages($);
    const videoCount = this.countVideos($);
    const linkCount = this.countLinks($);

    const textRatio = htmlLength > 0 ? textLength / htmlLength : 0;

    let isImageOnly = false;
    let isVideoOnly = false;
    let isEmpty = false;
    let needsReview = false;

    if (textLength === 0 && imageCount > 0) {
      isImageOnly = true;
      flags.push('PURE_IMAGE_CONTENT');
      needsReview = true;
    }

    if (videoCount > 0 && textLength < 100) {
      isVideoOnly = true;
      flags.push('VIDEO_HEAVY_CONTENT');
      needsReview = true;
    }

    if (htmlLength < opts.emptyContentLength) {
      isEmpty = true;
      flags.push('SHORT_CONTENT');
    }

    if (textRatio < opts.minTextRatio) {
      flags.push('LOW_TEXT_RATIO');
      needsReview = true;
    }

    if (!title || title.trim() === '' || title === '无标题') {
      flags.push('MISSING_TITLE');
      needsReview = true;
    }

    if (this.hasMpStyleType($)) {
      flags.push('STYLE_ONLY_CONTENT');
    }

    const qualityScore = this.calculateQualityScore({
      textLength,
      textRatio,
      imageCount,
      videoCount,
      hasTitle: !!title && title !== '无标题',
      htmlLength,
    });

    return {
      htmlLength,
      textLength,
      textRatio: Math.round(textRatio * 10000) / 10000,
      imageCount,
      videoCount,
      linkCount,
      isImageOnly,
      isVideoOnly,
      isEmpty,
      qualityScore: Math.round(qualityScore * 100) / 100,
      needsReview,
      flags,
    };
  }

  extractText($) {
    $('script').remove();
    $('style').remove();
    $('noscript').remove();
    return $('body').text().replace(/\s+/g, ' ');
  }

  countImages($) {
    return $('img').length;
  }

  countVideos($) {
    return $('video').length + $('iframe').length + $('embed').length;
  }

  countLinks($) {
    return $('a').length;
  }

  hasMpStyleType($) {
    return $('[data-mp-style-type]').length > 0;
  }

  calculateQualityScore(params) {
    let score = 0;

    if (params.htmlLength < 100) {
      return 0.1;
    }

    if (params.hasTitle) {
      score += 0.2;
    } else {
      score -= 0.2;
    }

    if (params.textLength > 1000) {
      score += 0.3;
    } else if (params.textLength > 500) {
      score += 0.2;
    } else if (params.textLength > 100) {
      score += 0.1;
    }

    if (params.textRatio > 0.1) {
      score += 0.3;
    } else if (params.textRatio > 0.05) {
      score += 0.15;
    } else if (params.textRatio < 0.01) {
      score -= 0.3;
    }

    if (params.videoCount > 0 && params.textLength > 500) {
      score += 0.1;
    }

    if (params.imageCount > 0 && params.textLength > 500) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  createEmptyResult(reason) {
    return {
      htmlLength: 0,
      textLength: 0,
      textRatio: 0,
      imageCount: 0,
      videoCount: 0,
      linkCount: 0,
      isImageOnly: false,
      isVideoOnly: false,
      isEmpty: true,
      qualityScore: 0,
      needsReview: true,
      flags: [reason],
    };
  }

  getRecommendation(quality) {
    if (quality.isEmpty) {
      return 'REJECT - 内容为空';
    }

    if (quality.qualityScore >= 0.7) {
      return 'ACCEPT - 高质量内容';
    }

    if (quality.qualityScore >= 0.4) {
      return 'ACCEPT_WITH_FLAG - 中等质量，标记后存储';
    }

    if (quality.isImageOnly) {
      return 'REVIEW - 纯图片内容，建议人工审核';
    }

    if (quality.flags.includes('LOW_TEXT_RATIO')) {
      return 'REVIEW - 文本占比过低，可能为视频/图片集';
    }

    return 'REJECT - 质量过低';
  }
}

if (require.main === module) {
  const analyzer = new ContentQualityAnalyzer();

  const testCases = [
    {
      name: '正常文章',
      html: '<p>这是一篇正常的文章，包含足够的文字内容。文章内容丰富，有很多描述性的文字。</p><p>第二段内容。</p>',
      title: '正常文章标题',
    },
    {
      name: '纯图片内容',
      html: '<section style="text-align:center;"><img src="a.jpg"/><img src="b.jpg"/></section>',
      title: '无标题',
    },
    {
      name: '低文本内容',
      html: '<section><img src="x.jpg" style="width:100%"/><p>配图</p></section>',
      title: '',
    },
    {
      name: '空内容',
      html: '',
      title: '无标题',
    },
  ];

  console.log('\n========================================');
  console.log('       内容质量分析测试');
  console.log('========================================\n');

  testCases.forEach((tc, i) => {
    const quality = analyzer.analyze(tc.html, tc.title);
    const recommendation = analyzer.getRecommendation(quality);

    console.log(`${i + 1}. ${tc.name}`);
    console.log(`   标题: "${tc.title}"`);
    console.log(`   HTML: ${quality.htmlLength} 字节 | 文本: ${quality.textLength} 字符 | 占比: ${(quality.textRatio * 100).toFixed(2)}%`);
    console.log(`   图片: ${quality.imageCount} | 视频: ${quality.videoCount}`);
    console.log(`   质量分: ${(quality.qualityScore * 100).toFixed(0)}%`);
    console.log(`   标记: [${quality.flags.join(', ')}]`);
    console.log(`   建议: ${recommendation}`);
    console.log('');
  });
}

module.exports = { ContentQualityAnalyzer };
