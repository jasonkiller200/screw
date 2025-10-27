@echo off
echo ===================================
echo     AI 資料庫查詢系統啟動器
echo ===================================
echo.

echo 1. 檢查 Ollama 服務狀態...
ollama ps 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  Ollama 服務未運行
    echo 正在啟動 Ollama 服務...
    start "" "ollama" serve
    timeout /t 3 /nobreak >nul
) else (
    echo ✅ Ollama 服務已運行
)

echo.
echo 2. 檢查 AI 模型...
ollama list | findstr "llama3.1:8b" >nul
if %errorlevel% neq 0 (
    echo ⚠️  未找到 llama3.1:8b 模型
    echo 正在下載模型（這可能需要幾分鐘）...
    ollama pull llama3.1:8b
) else (
    echo ✅ AI 模型已準備就緒
)

echo.
echo 3. 啟動 Flask 應用程式...
cd /d "%~dp0"
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ❌ 虛擬環境未找到，請先執行: python -m venv venv
    pause
    exit /b 1
)

echo 正在啟動應用程式...
echo 請在瀏覽器中訪問: https://localhost:5005/reports/ai-query
echo.
echo 按 Ctrl+C 停止服務
python app.py

pause