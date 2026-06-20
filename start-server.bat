@echo off
echo ================================
echo   李氏家谱服务器启动脚本
echo ================================
echo.

cd /d "%~dp0server"

if not exist "node_modules" (
  echo [1/2] 首次运行，正在安装依赖...
  call npm install
  echo.
)

echo [2/2] 启动服务器...
echo.
echo   访问地址：
echo   - 首页：http://localhost:3000
echo   - 局域网：http://你的IP:3000
echo.
echo   按 Ctrl+C 停止服务器
echo ================================
echo.

node server.js
pause
