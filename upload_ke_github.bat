@echo off
echo ==============================================
echo  SINKRONISASI GITHUB CULTURAL ENERGY YTDL
echo ==============================================
echo.
echo Mengumpulkan semua perubahan terbaru...
git add .
echo.
echo Menyimpan perubahan (Commit)...
git commit -m "Auto-update: Pembaruan aplikasi dari lokal"
echo.
echo Mengunggah ke GitHub...
git push origin main
echo.
echo ==============================================
echo  SINKRONISASI SELESAI!
echo ==============================================
pause
