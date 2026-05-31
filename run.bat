@echo off
echo ==================================================
echo Starting Remote File Viewer...
echo ==================================================
npx kill-port 3005
cd /d "c:\Users\Acer\OneDrive\Documents\GitHub\WifiShelf"
node server.js "d:\"
pause
