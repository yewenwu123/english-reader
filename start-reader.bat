@echo off
chcp 65001 >nul
title 双语翻转阅读器
cd /d "%~dp0"

set "PORT=8000"
set "URL=http://127.0.0.1:%PORT%/index.html"

where node >nul 2>nul
if errorlevel 1 (
  echo 没有找到 Node.js，无法启动本地服务。
  echo 请先安装 Node.js，或把项目部署到 GitHub Pages 后在线访问。
  pause
  exit /b 1
)

echo 正在启动双语翻转阅读器...
echo 地址：%URL%
echo.
start "" "%URL%"
node server.js

echo.
echo 服务已停止。
pause
