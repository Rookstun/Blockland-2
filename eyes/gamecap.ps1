# Capture the Brickadia window (even when behind other windows) to a PNG.
# usage: powershell -File gamecap.ps1 [out.png] [-Front]
param([string]$Out = "$PSScriptRoot\game.png", [switch]$Front)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  public struct RECT { public int L, T, R, B; } public struct POINT { public int X, Y; }
}
"@
$p = Get-Process BrickadiaSteam-Win64-Shipping -ErrorAction Stop | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
$h = $p.MainWindowHandle
if ([W]::IsIconic($h)) { [W]::ShowWindow($h, 9) | Out-Null; Start-Sleep -Milliseconds 400 }
$r = New-Object W+RECT; [W]::GetClientRect($h, [ref]$r) | Out-Null
$w = $r.R - $r.L; $ht = $r.B - $r.T
$bmp = New-Object System.Drawing.Bitmap $w, $ht; $g = [System.Drawing.Graphics]::FromImage($bmp)
if ($Front) {
  [W]::SetForegroundWindow($h) | Out-Null; Start-Sleep -Milliseconds 500
  $pt = New-Object W+POINT; [W]::ClientToScreen($h, [ref]$pt) | Out-Null
  $g.CopyFromScreen($pt.X, $pt.Y, 0, 0, $bmp.Size)
} else {
  $dc = $g.GetHdc(); [W]::PrintWindow($h, $dc, 3) | Out-Null; $g.ReleaseHdc($dc)  # 3 = client area + full content (DX)
}
$bmp.Save($Out); "$Out ${w}x${ht}"
