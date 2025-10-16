# PowerShell Script to Start the Flask Backend Server

# 確保在執行前，您已安裝 Python 和相關依賴
# 如果尚未安裝，請執行以下命令：
# pip install -r requirements.txt

# 檢查並啟動 Python 虛擬環境
$venvActivateScript = ".\venv\Scripts\Activate.ps1"
if (Test-Path $venvActivateScript) {
    Write-Host "正在啟動虛擬環境..." -ForegroundColor Green
    . $venvActivateScript
} else {
    Write-Host "警告: 找不到虛擬環境。請確保您已創建並安裝依賴。" -ForegroundColor Yellow
    Write-Host "您可以嘗試執行 'python -m venv venv' 然後 '.\venv\Scripts\Activate.ps1'" -ForegroundColor Yellow
    Write-Host "然後執行 'pip install -r requirements.txt'" -ForegroundColor Yellow
}

# 設定 Flask 應用程式檔案
$env:FLASK_APP = "app.py"

# 檢查 SSL 憑證是否存在
$certFile = "cert.pem"
$keyFile = "cert.key"

if (-not (Test-Path $certFile) -or -not (Test-Path $keyFile)) {
    Write-Host "警告: 找不到 SSL 憑證 (cert.pem 或 cert.key)。" -ForegroundColor Yellow
    Write-Host "伺服器將以 HTTP 模式啟動，iOS 裝置的 Service Worker 和相機功能將受限。" -ForegroundColor Yellow
    Write-Host "建議執行 'python generate_ssl_cert.py' 來生成憑證以啟用 HTTPS。" -ForegroundColor Yellow
    Write-Host "生成憑證後，請重新運行此腳本。" -ForegroundColor Yellow
}

Write-Host "正在啟動 Flask 伺服器..." -ForegroundColor Green
Write-Host "伺服器將在 http://0.0.0.0:5005 或 https://0.0.0.0:5005 上運行 (取決於 SSL 憑證是否存在)" -ForegroundColor Green
Write-Host "您可以透過本機 IP (例如 https://192.168.6.119:5005) 從區網內的其他設備訪問。" -ForegroundColor Green

# 啟動 Flask 應用程式
# 使用 start-process -NoNewWindow 讓腳本在當前 PowerShell 視窗中運行
# 如果需要新視窗，可以移除 -NoNewWindow
python app.py
