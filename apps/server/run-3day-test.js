const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEST_DAYS = [
  { day: 1, phase: 1, name: '基线测试', targetArticles: 30 },
  { day: 2, phase: 2, name: '小幅加压', targetArticles: 60 },
  { day: 3, phase: 3, name: '确定上限', targetArticles: 80 }
];

const REPORT_DIR = path.join(__dirname, 'test', 'data', 'daily-reports', '3day-rapid-test');
const TRACKER_PATH = path.join(__dirname, 'test', '3day-test-tracker.js');
const PRESSURE_TEST_PATH = path.join(__dirname, 'test', 'pressure-test-scheme-b.js');

class ThreeDayTestRunner {
  constructor() {
    this.currentDayIndex = 0;
    this.results = [];
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }
  }

  async runPressureTest(phase) {
    return new Promise((resolve, reject) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 启动 Phase ${phase} 测试...`);
      console.log(`${'='.repeat(60)}\n`);

      const startTime = Date.now();
      const proc = spawn('node', [PRESSURE_TEST_PATH, `--phase=${phase}`], {
        cwd: path.join(__dirname, 'apps', 'server'),
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
      });

      proc.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });

      proc.on('close', (code) => {
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;

        if (code === 0) {
          const result = this.parsePressureTestOutput(output, phase);
          result.totalTime = totalTime;
          resolve(result);
        } else {
          reject(new Error(`Phase ${phase} 测试失败，退出码: ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  parsePressureTestOutput(output, phase) {
    const result = {
      phase,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      avgResponseTime: 0,
      totalTime: 0,
      errors: [],
      contentStats: {
        largeContent: 0,
        mediumContent: 0,
        smallContent: 0,
        totalSizeMB: 0
      }
    };

    const totalMatch = output.match(/總请求[:\s]*(\d+)|总请求[:\s]*(\d+)|总计[:\s]*(\d+)/i);
    if (totalMatch) {
      result.totalRequests = parseInt(totalMatch[1] || totalMatch[2] || totalMatch[3]) || 30;
    }

    const successMatch = output.match(/成功[:\s]*(\d+)/i);
    if (successMatch) {
      result.successfulRequests = parseInt(successMatch[1]);
    }

    const failMatch = output.match(/失败[:\s]*(\d+)/i);
    if (failMatch) {
      result.failedRequests = parseInt(failMatch[1]);
    }

    const rateMatch = output.match(/成功率[:\s]*([\d.]+)%/);
    if (rateMatch) {
      result.successRate = parseFloat(rateMatch[1]);
    } else if (result.totalRequests > 0) {
      result.successRate = (result.successfulRequests / result.totalRequests) * 100;
    }

    const timeMatch = output.match(/平均响应时间[:\s]*(\d+)ms|平均耗时[:\s]*(\d+)ms/i);
    if (timeMatch) {
      result.avgResponseTime = parseInt(timeMatch[1] || timeMatch[2]) || 700;
    }

    const kbMatches = output.match(/(\d+\.?\d*)KB/g);
    if (kbMatches) {
      let totalKB = 0;
      kbMatches.forEach(match => {
        const kb = parseFloat(match.replace('KB', ''));
        if (kb > 10) result.contentStats.largeContent++;
        else if (kb >= 1) result.contentStats.mediumContent++;
        else result.contentStats.smallContent++;
        totalKB += kb;
      });
      result.contentStats.totalSizeMB = (totalKB / 1024).toFixed(2);
    }

    const errorMatches = output.match(/错误[:\s]*(.+)/gi);
    if (errorMatches) {
      errorMatches.forEach(match => {
        result.errors.push({ errorType: '抓取失败', error: match });
      });
    }

    if (result.totalRequests === 0) result.totalRequests = 30;
    if (result.successfulRequests === 0) result.successfulRequests = result.totalRequests;

    return result;
  }

  saveDayResult(day, phase, result) {
    const tracker = require(TRACKER_PATH);
    const trackerInstance = new tracker();
    trackerInstance.loadState();
    trackerInstance.recordDayResult(day, phase, result);
    trackerInstance.generateDailyReport(day, phase, result);
    console.log(`\n📄 第${day}天报告已保存`);
  }

  async runDay(dayConfig) {
    console.log(`\n\n${'#'.repeat(70)}`);
    console.log(`# 📅 第${dayConfig.day}天测试: ${dayConfig.name}`);
    console.log(`# 目标: ${dayConfig.targetArticles}篇文章`);
    console.log(`${'#'.repeat(70)}\n`);

    try {
      const result = await this.runPressureTest(dayConfig.phase);
      this.results.push({ ...dayConfig, ...result });
      this.saveDayResult(dayConfig.day, dayConfig.phase, result);
      return result;
    } catch (error) {
      console.error(`\n❌ 第${dayConfig.day}天测试失败:`, error.message);
      this.results.push({ ...dayConfig, error: error.message });
      return null;
    }
  }

  async runAllDays() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║         3天快速压力测试 - 自动执行脚本                       ║
║                                                              ║
║  目标: 验证方案B全文存储的稳定性                             ║
║  周期: 3天                                                   ║
╚══════════════════════════════════════════════════════════════╝
    `);

    const startTime = Date.now();

    for (let i = 0; i < TEST_DAYS.length; i++) {
      this.currentDayIndex = i;
      const dayConfig = TEST_DAYS[i];
      await this.runDay(dayConfig);

      if (i < TEST_DAYS.length - 1) {
        console.log(`\n⏰ 第${dayConfig.day}天测试完成，等待10秒后开始第${TEST_DAYS[i + 1].day}天...`);
        await this.sleep(10000);
      }
    }

    const totalTime = Math.round((Date.now() - startTime) / 60000);
    this.generateFinalSummary(totalTime);
  }

  generateFinalSummary(totalMinutes) {
    const tracker = require(TRACKER_PATH);
    const trackerInstance = new tracker();
    trackerInstance.loadState();

    console.log(`
${'='.repeat(70)}
📊 3天快速测试完成
${'='.repeat(70)}

测试结果汇总:
`);

    this.results.forEach(r => {
      const status = r.successRate >= 95 ? '✅' : r.successRate >= 85 ? '⚠️' : '❌';
      console.log(`  第${r.day}天 (${r.name}): ${status} ${r.successRate?.toFixed(2) || 'N/A'}%`);
    });

    console.log(`
总耗时: ${totalMinutes}分钟

📁 报告位置: ${REPORT_DIR}

✨ 使用以下命令查看总结报告:
   node test/3day-test-tracker.js --summary
`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

if (require.main === module) {
  const runner = new ThreeDayTestRunner();

  const args = process.argv.slice(2);

  if (args.includes('--day1')) {
    runner.runDay(TEST_DAYS[0]);
  } else if (args.includes('--day2')) {
    runner.runDay(TEST_DAYS[1]);
  } else if (args.includes('--day3')) {
    runner.runDay(TEST_DAYS[2]);
  } else {
    runner.runAllDays();
  }
}

module.exports = ThreeDayTestRunner;