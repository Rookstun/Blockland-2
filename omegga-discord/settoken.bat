@echo off
echo Paste the Discord bot token (right-click to paste), then press Enter:
powershell -NoProfile -Command "$t = Read-Host; $t | ssh pzedlo.hopto.org '~/node22/bin/node ~/omegga-server/plugins/discord/settoken.mjs'"
pause
