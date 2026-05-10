param(
    [Parameter(Mandatory=$true)]
    [string]$newVersion
)

Write-Host "Updating version to $newVersion..." -ForegroundColor Cyan

# 更新根目录下的 package.json
$pkgPath = "package.json"
if (Test-Path $pkgPath) {
    (Get-Content $pkgPath -Raw) -replace '"version": ".*?"', "`"version`": `"$newVersion`"" | Set-Content $pkgPath -NoNewline
    Write-Host "Updated $pkgPath" -ForegroundColor Green
}

# 更新 apps 目录下所有子包的 package.json
Get-ChildItem apps -Directory | ForEach-Object {
    $appPkgPath = Join-Path $_.FullName "package.json"
    if (Test-Path $appPkgPath) {
        (Get-Content $appPkgPath -Raw) -replace '"version": ".*?"', "`"version`": `"$newVersion`"" | Set-Content $appPkgPath -NoNewline
        Write-Host "Updated $appPkgPath" -ForegroundColor Green
    }
}

Write-Host "`nAll packages updated to version $newVersion" -ForegroundColor Cyan

# 创建 Git 提交（可选）
git add .
git commit -m "Release version $newVersion"

# 创建 Git 标签
git tag "v$newVersion"

# 推送更改和标签到远程仓库
git push
git push origin --tags

Write-Host "`nGit tag v$newVersion has been created and pushed" -ForegroundColor Cyan
