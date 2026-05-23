/**
 * 自动降级配置脚本
 *
 * 使用方式:
 *   node test/auto-downgrade.js --current=3 --auto
 *   node test/auto-downgrade.js --show-all
 *
 * 功能:
 *   - 根据当前状态自动计算降级配置
 *   - 支持手动指定当前阶段
 *   - 显示所有阶段的备选配置
 */

const fs = require('fs');
const path = require('path');

// 当前配置的阶段定义
const PHASE_CONFIGS = {
  1: {
    name: '基线测试',
    maxFeedsPerBatch: 3,
    maxArticlesPerFeed: 5,
    minDelaySeconds: 30,
    maxDelaySeconds: 120,
    batchIntervalSeconds: 300,
    dailyBudget: 50,
    successThreshold: 0.98,
  },
  2: {
    name: '小幅加压',
    maxFeedsPerBatch: 5,
    maxArticlesPerFeed: 8,
    minDelaySeconds: 20,
    maxDelaySeconds: 90,
    batchIntervalSeconds: 240,
    dailyBudget: 80,
    successThreshold: 0.95,
  },
  3: {
    name: '接近上限',
    maxFeedsPerBatch: 8,
    maxArticlesPerFeed: 10,
    minDelaySeconds: 15,
    maxDelaySeconds: 60,
    batchIntervalSeconds: 180,
    dailyBudget: 100,
    successThreshold: 0.90,
  },
  4: {
    name: '极限试探',
    maxFeedsPerBatch: 10,
    maxArticlesPerFeed: 12,
    minDelaySeconds: 10,
    maxDelaySeconds: 45,
    batchIntervalSeconds: 120,
    dailyBudget: 120,
    successThreshold: 0.85,
  },
  5: {
    name: '安全配置验证',
    maxFeedsPerBatch: 8,
    maxArticlesPerFeed: 10,
    minDelaySeconds: 15,
    maxDelaySeconds: 60,
    batchIntervalSeconds: 180,
    dailyBudget: 100,
    successThreshold: 0.95,
  },
  6: {
    name: '配置微调',
    maxFeedsPerBatch: 8,
    maxArticlesPerFeed: 12,
    minDelaySeconds: 15,
    maxDelaySeconds: 45,
    batchIntervalSeconds: 150,
    dailyBudget: 110,
    successThreshold: 0.93,
  },
  7: {
    name: '最终验证',
    maxFeedsPerBatch: 10,
    maxArticlesPerFeed: 10,
    minDelaySeconds: 15,
    maxDelaySeconds: 45,
    batchIntervalSeconds: 120,
    dailyBudget: 120,
    successThreshold: 0.92,
  },
};

class AutoDowngrader {
  constructor() {
    this.dataDir = path.join(__dirname, 'data', 'pressure-test');
    this.logFile = path.join(this.dataDir, 'downgrade-log.json');
  }

  loadLatestMetrics() {
    if (!fs.existsSync(this.dataDir)) {
      return null;
    }

    const files = fs.readdirSync(this.dataDir)
      .filter(f => f.startsWith('report-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return null;
    }

    const content = fs.readFileSync(path.join(this.dataDir, files[0]), 'utf8');
    return JSON.parse(content);
  }

  calculateDowngradedConfig(currentPhase, severity = 'warning') {
    const current = PHASE_CONFIGS[currentPhase];
    if (!current) {
      console.log(`❌ 无效的阶段: ${currentPhase}`);
      return null;
    }

    const reductionFactor = severity === 'danger' ? 0.5 : 0.8;
    const delayIncreaseFactor = severity === 'danger' ? 1.5 : 1.3;
    const intervalIncreaseFactor = severity === 'danger' ? 2.0 : 1.5;

    return {
      name: `${current.name} (降级后)`,
      maxFeedsPerBatch: Math.max(1, Math.floor(current.maxFeedsPerBatch * reductionFactor)),
      maxArticlesPerFeed: Math.max(3, Math.floor(current.maxArticlesPerFeed * reductionFactor)),
      minDelaySeconds: Math.ceil(current.minDelaySeconds * delayIncreaseFactor),
      maxDelaySeconds: Math.ceil(current.maxDelaySeconds * delayIncreaseFactor),
      batchIntervalSeconds: Math.ceil(current.batchIntervalSeconds * intervalIncreaseFactor),
      dailyBudget: Math.floor(current.dailyBudget * reductionFactor),
      successThreshold: current.successThreshold,
    };
  }

  calculateSafeConfig(currentPhase) {
    const current = PHASE_CONFIGS[currentPhase];
    if (!current) {
      return null;
    }

    return {
      name: `${current.name} (安全配置)`,
      maxFeedsPerBatch: Math.floor(current.maxFeedsPerBatch * 0.8),
      maxArticlesPerFeed: Math.floor(current.maxArticlesPerFeed * 0.8),
      minDelaySeconds: Math.ceil(current.minDelaySeconds * 1.2),
      maxDelaySeconds: Math.ceil(current.maxDelaySeconds * 1.2),
      batchIntervalSeconds: Math.ceil(current.batchIntervalSeconds * 1.3),
      dailyBudget: Math.floor(current.dailyBudget * 0.8),
      successThreshold: current.successThreshold * 0.95,
    };
  }

  logDowngrade(currentPhase, newConfig, reason) {
    const logs = fs.existsSync(this.logFile)
      ? JSON.parse(fs.readFileSync(this.logFile, 'utf8'))
      : [];

    logs.push({
      timestamp: new Date().toISOString(),
      previousPhase: currentPhase,
      previousConfig: { ...PHASE_CONFIGS[currentPhase] },
      newConfig: { ...newConfig },
      reason,
    });

    fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
    console.log(`📝 降级记录已保存: ${this.logFile}`);
  }

  showDowngradeRecommendation() {
    const latestMetrics = this.loadLatestMetrics();

    if (!latestMetrics) {
      console.log('❌ 未找到测试数据，请先运行压力测试');
      return;
    }

    console.log('\n' + '═'.repeat(70));
    console.log('🔧 自动降级配置建议');
    console.log('═'.repeat(70));

    console.log(`\n📊 当前状态 (${latestMetrics.date} - Phase ${latestMetrics.phase})`);
    console.log(`  成功率: ${(latestMetrics.metrics.successRate * 100).toFixed(1)}%`);
    console.log(`  状态: ${latestMetrics.status}`);
    console.log(`  当前配置: ${PHASE_CONFIGS[latestMetrics.phase]?.name || '未知'}`);

    let severity = 'warning';
    if (latestMetrics.metrics.successRate < 0.60) {
      severity = 'danger';
    } else if (latestMetrics.metrics.successRate < 0.85) {
      severity = 'danger';
    } else if (latestMetrics.metrics.successRate < 0.95) {
      severity = 'warning';
    }

    console.log(`\n⚠️  降级级别: ${severity === 'danger' ? '🟠 危险' : '🟡 警告'}`);

    const downgradedConfig = this.calculateDowngradedConfig(latestMetrics.phase, severity);
    const safeConfig = this.calculateSafeConfig(latestMetrics.phase);

    console.log('\n📋 降级后配置（建议）');
    console.log('┌─────────────────────────────┬──────────────────┬──────────────────┐');
    console.log('│ 参数                       │ 当前值           │ 降级后值         │');
    console.log('├─────────────────────────────┼──────────────────┼──────────────────┤');
    console.log(`│ 公众号数/批次               │ ${String(PHASE_CONFIGS[latestMetrics.phase].maxFeedsPerBatch).padEnd(17)}│ ${String(downgradedConfig.maxFeedsPerBatch).padEnd(17)}│`);
    console.log(`│ 文章数/公众号               │ ${String(PHASE_CONFIGS[latestMetrics.phase].maxArticlesPerFeed).padEnd(17)}│ ${String(downgradedConfig.maxArticlesPerFeed).padEnd(17)}│`);
    console.log(`│ 最小延迟(秒)                │ ${String(PHASE_CONFIGS[latestMetrics.phase].minDelaySeconds).padEnd(17)}│ ${String(downgradedConfig.minDelaySeconds).padEnd(17)}│`);
    console.log(`│ 最大延迟(秒)                │ ${String(PHASE_CONFIGS[latestMetrics.phase].maxDelaySeconds).padEnd(17)}│ ${String(downgradedConfig.maxDelaySeconds).padEnd(17)}│`);
    console.log(`│ 批次间隔(秒)                │ ${String(PHASE_CONFIGS[latestMetrics.phase].batchIntervalSeconds).padEnd(17)}│ ${String(downgradedConfig.batchIntervalSeconds).padEnd(17)}│`);
    console.log(`│ 每日预算                    │ ${String(PHASE_CONFIGS[latestMetrics.phase].dailyBudget).padEnd(17)}│ ${String(downgradedConfig.dailyBudget).padEnd(17)}│`);
    console.log('└─────────────────────────────┴──────────────────┴──────────────────┘');

    console.log('\n📋 安全配置（备用）');
    console.log('┌─────────────────────────────┬──────────────────┐');
    console.log('│ 参数                       │ 安全值           │');
    console.log('├─────────────────────────────┼──────────────────┤');
    console.log(`│ 公众号数/批次               │ ${String(safeConfig.maxFeedsPerBatch).padEnd(17)}│`);
    console.log(`│ 文章数/公众号               │ ${String(safeConfig.maxArticlesPerFeed).padEnd(17)}│`);
    console.log(`│ 最小延迟(秒)                │ ${String(safeConfig.minDelaySeconds).padEnd(17)}│`);
    console.log(`│ 最大延迟(秒)                │ ${String(safeConfig.maxDelaySeconds).padEnd(17)}│`);
    console.log(`│ 批次间隔(秒)                │ ${String(safeConfig.batchIntervalSeconds).padEnd(17)}│`);
    console.log(`│ 每日预算                    │ ${String(safeConfig.dailyBudget).padEnd(17)}│`);
    console.log('└─────────────────────────────┴──────────────────┘');

    console.log('\n📝 下一步操作建议');
    if (severity === 'danger') {
      console.log('  1. 立即停止当前测试');
      console.log('  2. 等待 30 分钟让系统冷却');
      console.log('  3. 使用降级后配置重新开始测试');
      console.log('  4. 如果继续失败，使用安全配置');
    } else {
      console.log('  1. 降低 20% 负载继续测试');
      console.log('  2. 观察 30 分钟内的成功率变化');
      console.log('  3. 如果成功率回升，可尝试小幅度加压');
    }

    console.log('\n' + '═'.repeat(70));

    return { downgradedConfig, safeConfig };
  }

  showAllConfigs() {
    console.log('\n' + '═'.repeat(70));
    console.log('📋 所有测试阶段配置');
    console.log('═'.repeat(70));

    for (const [phase, config] of Object.entries(PHASE_CONFIGS)) {
      console.log(`\n【Phase ${phase}】${config.name}`);
      console.log(`  公众号/批次: ${config.maxFeedsPerBatch}`);
      console.log(`  文章/公众号: ${config.maxArticlesPerFeed}`);
      console.log(`  延迟范围: ${config.minDelaySeconds}-${config.maxDelaySeconds}秒`);
      console.log(`  批次间隔: ${config.batchIntervalSeconds}秒`);
      console.log(`  每日预算: ${config.dailyBudget}次`);
      console.log(`  期望成功率: ${(config.successThreshold * 100).toFixed(0)}%+`);
    }

    console.log('\n' + '═'.repeat(70));
  }

  showDowngradeHistory() {
    if (!fs.existsSync(this.logFile)) {
      console.log('📝 暂无降级记录');
      return;
    }

    const logs = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));

    console.log('\n' + '═'.repeat(70));
    console.log('📝 降级历史记录');
    console.log('═'.repeat(70));

    logs.reverse().forEach((log, index) => {
      console.log(`\n【记录 ${index + 1}】${log.timestamp}`);
      console.log(`  原因: ${log.reason}`);
      console.log(`  阶段: Phase ${log.previousPhase} → 新配置`);
      console.log(`  变更: 公众号 ${log.previousConfig.maxFeedsPerBatch} → ${log.newConfig.maxFeedsPerBatch}`);
      console.log(`       文章 ${log.previousConfig.maxArticlesPerFeed} → ${log.newConfig.maxArticlesPerFeed}`);
      console.log(`       延迟 ${log.previousConfig.minDelaySeconds}-${log.previousConfig.maxDelaySeconds}秒 → ${log.newConfig.minDelaySeconds}-${log.newConfig.maxDelaySeconds}秒`);
    });

    console.log('\n' + '═'.repeat(70));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const downgrader = new AutoDowngrader();

  if (args.includes('--show-all')) {
    downgrader.showAllConfigs();
  } else if (args.includes('--history')) {
    downgrader.showDowngradeHistory();
  } else if (args.includes('--auto')) {
    const result = downgrader.showDowngradeRecommendation();

    if (result) {
      const latestMetrics = downgrader.loadLatestMetrics();
      if (latestMetrics && result.downgradedConfig) {
        const severity = latestMetrics.metrics.successRate < 0.85 ? 'danger' : 'warning';
        downgrader.logDowngrade(
          latestMetrics.phase,
          result.downgradedConfig,
          `成功率低于${severity === 'danger' ? '85%' : '95%'}`
        );
      }
    }
  } else {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              爬虫压力测试 - 自动降级配置工具                        ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  使用方式:                                                         ║
║    node test/auto-downgrade.js --auto                             ║
║      - 根据最新测试数据，自动计算降级配置                          ║
║      - 需要先运行过压力测试                                        ║
║                                                                  ║
║    node test/auto-downgrade.js --show-all                        ║
║      - 显示所有测试阶段的配置                                      ║
║                                                                  ║
║    node test/auto-downgrade.js --history                          ║
║      - 显示降级历史记录                                            ║
║                                                                  ║
║  自动降级规则:                                                     ║
║    警告 (成功率 < 95%):                                           ║
║      - 公众号数: -20%                                              ║
║      - 文章数: -20%                                                ║
║      - 延迟: +30%                                                  ║
║      - 批次间隔: +50%                                               ║
║                                                                  ║
║    危险 (成功率 < 85%):                                          ║
║      - 公众号数: -50%                                              ║
║      - 文章数: -50%                                                ║
║      - 延迟: +50%                                                  ║
║      - 批次间隔: +100%                                              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
    `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AutoDowngrader, PHASE_CONFIGS };
