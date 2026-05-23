# wewe-rss 测试数据生成脚本
# 使用方法: 在 PowerShell 中运行 .\generate_test_data.ps1

$sqlitePath = "D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server\data\dev.db"
$scriptPath = $PSScriptRoot

# 确保目录存在
New-Item -ItemType Directory -Path "D:\Trae_info_collection_app\wewe-rss\wewe-rss\apps\server\data" -Force | Out-Null

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "wewe-rss 测试数据生成脚本" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 检查 SQLite 是否可用
try {
    $sqlite = Get-Command sqlite3 -ErrorAction Stop
    Write-Host "✓ SQLite3 已安装" -ForegroundColor Green
} catch {
    Write-Host "✗ SQLite3 未安装，请先安装 SQLite" -ForegroundColor Red
    exit 1
}

# 创建测试数据 SQL
$testDataSql = @"
-- 删除现有数据（测试用）
DELETE FROM articles;
DELETE FROM feeds;
DELETE FROM accounts;

-- 插入测试账号
INSERT INTO accounts (id, token, name, status) VALUES
('test_account_1', 'test_token_123456', '测试账号', 1);

-- 插入测试公众号（3个）
INSERT INTO feeds (id, mp_name, mp_cover, mp_intro, status, sync_time, update_time, has_history) VALUES
('mp_001', '科技前沿', 'https://picsum.photos/100/100?random=1', '专注科技领域最新资讯', 1, $(Get-Date -UFormat "%s"), $(Get-Date -UFormat "%s"), 1),
('mp_002', '美食天下', 'https://picsum.photos/100/100?random=2', '分享美食食谱与烹饪技巧', 1, $(Get-Date -UFormat "%s"), $(Get-Date -UFormat "%s"), 1),
('mp_003', '旅行日记', 'https://picsum.photos/100/100?random=3', '记录旅行中的美好时光', 1, $(Get-Date -UFormat "%s"), $(Get-Date -UFormat "%s"), 1);

-- 插入测试文章（每公众号3篇，共9篇）
INSERT INTO articles (id, mp_id, title, pic_url, publish_time) VALUES
-- 科技前沿
('art_001', 'mp_001', '2024年人工智能发展趋势展望', 'https://picsum.photos/400/250?random=1', $(Get-Date -UFormat "%s")),
('art_002', 'mp_001', '量子计算突破：新算法大幅提升效率', 'https://picsum.photos/400/250?random=2', $(Get-Date -UFormat "%s")),
('art_003', 'mp_001', '自动驾驶技术迎来新里程碑', 'https://picsum.photos/400/250?random=3', $(Get-Date -UFormat "%s")),
-- 美食天下
('art_004', 'mp_002', '家常红烧肉的正宗做法', 'https://picsum.photos/400/250?random=4', $(Get-Date -UFormat "%s")),
('art_005', 'mp_002', '夏日清凉甜品推荐', 'https://picsum.photos/400/250?random=5', $(Get-Date -UFormat "%s")),
('art_006', 'mp_002', '零基础烘焙入门指南', 'https://picsum.photos/400/250?random=6', $(Get-Date -UFormat "%s")),
-- 旅行日记
('art_007', 'mp_003', '云南大理深度游攻略', 'https://picsum.photos/400/250?random=7', $(Get-Date -UFormat "%s")),
('art_008', 'mp_003', '西藏自驾游注意事项', 'https://picsum.photos/400/250?random=8', $(Get-Date -UFormat "%s")),
('art_009', 'mp_003', '海岛度假最佳目的地推荐', 'https://picsum.photos/400/250?random=9', $(Get-Date -UFormat "%s"));

SELECT '测试数据插入完成' as result;
"@

# 写入临时文件
$tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
$testDataSql | Out-File -FilePath $tempFile -Encoding utf8

Write-Host "正在创建测试数据库..." -ForegroundColor Yellow

# 执行 SQL
sqlite3 $sqlitePath < $tempFile

if ($?) {
    Write-Host ""
    Write-Host "✓ 测试数据生成成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "数据库位置: $sqlitePath" -ForegroundColor White
    Write-Host ""
    Write-Host "测试数据包含:" -ForegroundColor Cyan
    Write-Host "  - 1 个测试账号" -ForegroundColor White
    Write-Host "  - 3 个公众号" -ForegroundColor White
    Write-Host "  - 9 篇文章" -ForegroundColor White
    Write-Host ""
    Write-Host "接下来可以启动服务测试防封号逻辑:" -ForegroundColor Cyan
    Write-Host "  cd D:\Trae_info_collection_app\wewe-rss\wewe-rss" -ForegroundColor White
    Write-Host "  pnpm install" -ForegroundColor White
    Write-Host "  pnpm run dev" -ForegroundColor White
} else {
    Write-Host "✗ 测试数据生成失败" -ForegroundColor Red
}

# 清理临时文件
Remove-Item $tempFile -Force

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan