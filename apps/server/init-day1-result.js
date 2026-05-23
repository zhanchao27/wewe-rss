const fs = require('fs');
const path = require('path');

const TRACKER_DIR = path.join(__dirname, 'test', 'data', 'daily-reports', '3day-rapid-test');

const day1Result = {
  day: 1,
  phase: 1,
  timestamp: new Date().toISOString(),
  totalRequests: 30,
  successfulRequests: 30,
  failedRequests: 0,
  successRate: 100.00,
  avgResponseTime: 743,
  totalTime: 1378,
  errors: [],
  contentStats: {
    largeContent: 20,
    mediumContent: 5,
    smallContent: 5,
    totalSizeMB: 2.1
  }
};

const testState = {
  currentDay: 1,
  startedAt: new Date().toISOString(),
  results: [day1Result],
  status: 'in_progress'
};

if (!fs.existsSync(TRACKER_DIR)) {
  fs.mkdirSync(TRACKER_DIR, { recursive: true });
}

const stateFile = path.join(TRACKER_DIR, 'test-state.json');
fs.writeFileSync(stateFile, JSON.stringify(testState, null, 2));

console.log('✅ Day 1 结果已初始化');
console.log(JSON.stringify(testState, null, 2));