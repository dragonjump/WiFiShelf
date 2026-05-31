Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Starting Remote File Viewer..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Kill existing process on 3004
npx kill-port 3004

# Run the node app serving D:\
Set-Location "c:\Users\Acer\OneDrive\Documents\GitHub\file-sync-preview"
node server.js "d:\"
