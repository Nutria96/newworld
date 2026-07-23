[CmdletBinding()]
param(
    [string]$Destino = "1.1.1.1",
    [ValidateRange(1, 20)]
    [int]$MuestrasPing = 5
)

$ErrorActionPreference = "Continue"
$BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ReportPath = Join-Path $BaseDir "ESTADO_RED.md"
$WifiPath = Join-Path $BaseDir "wifi_scan.txt"
$TracePath = Join-Path $BaseDir "trazado_red.txt"

function Section {
    param([string]$Title, [object]$Value)
    @("## $Title", "", '```text', ([string]$Value).Trim(), '```', "")
}

$timestamp = Get-Date
$gateway = (Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
    Sort-Object RouteMetric | Select-Object -First 1).NextHop
$pingTarget = Test-Connection -ComputerName $Destino -Count $MuestrasPing -ErrorAction SilentlyContinue
$pingGateway = if ($gateway) { Test-Connection -ComputerName $gateway -Count 3 -ErrorAction SilentlyContinue }
$latency = if ($pingTarget) { [math]::Round(($pingTarget | Measure-Object ResponseTime -Average).Average, 1) } else { $null }
$loss = [math]::Round((1 - (@($pingTarget).Count / $MuestrasPing)) * 100, 1)

$neighbors = @(Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.State -in @("Reachable", "Stale", "Delay", "Probe") -and $_.IPAddress -notmatch "^(127|169\.254)\." })
$neighborSummary = $neighbors | Select-Object InterfaceAlias, IPAddress, State |
    Sort-Object InterfaceAlias, IPAddress | Format-Table -AutoSize | Out-String

$wifiRaw = (& netsh wlan show networks mode=bssid 2>&1 | Out-String)
Set-Content -LiteralPath $WifiPath -Value $wifiRaw -Encoding utf8
$bssidCount = @($wifiRaw -split "`r?`n" | Where-Object { $_ -match "^\s*BSSID\s+\d+\s*:" }).Count
$channels = @($wifiRaw -split "`r?`n" | Where-Object { $_ -match "^\s*(Canal|Channel)\s*:" } |
    ForEach-Object { ($_ -split ":", 2)[1].Trim() })
$channelSummary = if ($channels.Count) {
    $channels | Group-Object | Sort-Object Count -Descending |
        ForEach-Object { "Canal $($_.Name): $($_.Count) BSSID detectado(s)" }
} else { @("No se obtuvieron canales; quiz? no hay adaptador WiFi activo.") }

$trace = (& tracert -d -w 800 $Destino 2>&1 | Out-String)
Set-Content -LiteralPath $TracePath -Value $trace -Encoding utf8
$netStats = (& netstat -e -s 2>&1 | Out-String)

$speedtest = Get-Command speedtest -ErrorAction SilentlyContinue
$speedOutput = if ($speedtest) {
    & $speedtest.Source --accept-license --accept-gdpr -f json 2>&1 | Out-String
} else {
    "No ejecutado: instala manualmente la CLI oficial de Ookla si deseas medir descarga/subida."
}

$report = @(
    "# Estado de la red CHONGSEB",
    "",
    "- **Fecha:** $($timestamp.ToString('yyyy-MM-dd HH:mm:ss zzz'))",
    "- **Destino de prueba:** $Destino",
    "- **Gateway detectado:** $(if ($gateway) {$gateway} else {'No detectado'})",
    "- **Latencia media:** $(if ($null -ne $latency) {"$latency ms"} else {'Sin respuesta'})",
    "- **P?rdida estimada:** $loss %",
    "- **Vecinos IPv4 observados desde esta PC:** $($neighbors.Count)",
    "- **BSSID WiFi observados:** $bssidCount",
    "",
    "> Los vecinos observados no equivalen al total de clientes del router. Para el conteo real consulta DHCP/asociaciones en el equipo administrador.",
    "> El escaneo WiFi es una fotograf?a local; paredes, altura, clima y dispositivo cambian el resultado.",
    "",
    "## Canales observados",
    "",
    ($channelSummary -join [Environment]::NewLine),
    ""
)
$report += Section "Prueba de velocidad" $speedOutput
$report += Section "Vecinos de red observados" $neighborSummary
$report += Section "Estad?sticas de Windows" $netStats
$report += @(
    "## Archivos auxiliares",
    "",
    "- `wifi_scan.txt`: salida sin procesar del escaneo inal?mbrico.",
    "- `trazado_red.txt`: ruta hacia el destino de prueba.",
    "",
    "> Revisa y elimina IP, MAC, nombres de interfaces u otros datos sensibles antes de compartir el reporte."
)
Set-Content -LiteralPath $ReportPath -Value ($report -join [Environment]::NewLine) -Encoding utf8
Write-Host "Diagn?stico guardado en $ReportPath" -ForegroundColor Green
