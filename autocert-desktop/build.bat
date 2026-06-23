@echo off
echo [.NET Build]
dotnet publish -c Release -r win-x64 --self-contained false
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo [NSIS Installer Build]
"C:\Program Files (x86)\NSIS\makensis.exe" setup.nsi
if %errorlevel% neq 0 (
    echo Installer build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo [Done] AutoCertPrint_Setup.exe has been created.
pause
