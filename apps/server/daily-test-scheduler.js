const path = require('path');
const fs = require('fs');

const TRACKER_DIR = path.join(__dirname, 'test', 'data', 'daily-reports', '3day-rapid-test');

function getNextDayToRun() {
  const stateFile = path.join(TRACKER_DIR, 'test-state.json');

  if (!fs.existsSync(stateFile)) {
    console.log('❌ 未找到测试状态文件，请先手动运行Day 1');
    return null;
  }

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  const completedDays = state.results ? state.results.length : 0;
  const nextDay = completedDays + 1;

  if (nextDay > 3) {
    console.log('✅ 3天测试已全部完成！');
    console.log('使用以下命令查看总结报告:');
    console.log('   node test/daily-report.js --3day');
    return null;
  }

  console.log(`📅 检测到已完成 ${completedDays} 天测试，即将运行第 ${nextDay} 天测试...`);
  return nextDay;
}

const nextDay = getNextDayToRun();

if (nextDay) {
  const { spawn } = require('child_process');
  const phaseArg = `--phase=${nextDay}`;

  console.log(`\n🚀 启动 Phase ${nextDay} 测试...\n`);

  const proc = spawn('node', ['test/pressure-test-scheme-b.js', phaseArg], {
    cwd: __dirname,
    shell: true
  });

  proc.stdout.on('data', (data) => process.stdout.write(data.toString()));
  proc.stderr.on('data', (data) => process.stderr.write(data.toString()));

  proc.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ 测试完成！');
      console.log('查看报告: node test/daily-report.js --3day');
    } else {
      console.log(`\n❌ 测试失败，退出码: ${code}`);
    }
  });
}