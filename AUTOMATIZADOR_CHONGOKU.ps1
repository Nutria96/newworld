# ============================================================
# AUTOMATIZADOR_CHONGOKU.ps1
# Sistema de automatización con IA DeepSeek
# Soporte multiidioma, retroalimentación y mejora continua
# ============================================================

# --- CONFIGURACIÓN INICIAL ---
$ErrorActionPreference = "Stop"
$escritorio = [Environment]::GetFolderPath("Desktop")
$carpetaRaiz = Join-Path $escritorio "AUTOMATIZADOR_CHONGOKU"
$carpetaModulos = Join-Path $carpetaRaiz "MODULOS"
$carpetaLogs = Join-Path $carpetaRaiz "LOGS"
$carpetaConfig = Join-Path $carpetaRaiz "CONFIG"
$carpetaRespuestas = Join-Path $carpetaRaiz "RESPUESTAS"
$carpetaIdiomas = Join-Path $carpetaRaiz "IDIOMAS"

# Crear estructura de carpetas
foreach ($carpeta in @($carpetaRaiz, $carpetaModulos, $carpetaLogs, $carpetaConfig, $carpetaRespuestas, $carpetaIdiomas)) {
    if (-not (Test-Path $carpeta)) {
        New-Item -ItemType Directory -Path $carpeta -Force | Out-Null
    }
}

# --- FUNCIONES AUXILIARES ---
function Write-Log {
    param([string]$Mensaje, [string]$Nivel = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $linea = "[$timestamp] [$Nivel] $Mensaje"
    Write-Host $linea
    $logFile = Join-Path $carpetaLogs "interacciones.log"
    Add-Content -Path $logFile -Value $linea
}

function Leer-Config {
    $configFile = Join-Path $carpetaConfig "config.json"
    if (Test-Path $configFile) {
        $config = Get-Content -Path $configFile -Raw | ConvertFrom-Json
        return $config
    } else {
        return $null
    }
}

function Guardar-Config {
    param($Config)
    $configFile = Join-Path $carpetaConfig "config.json"
    $Config | ConvertTo-Json | Out-File -FilePath $configFile -Encoding UTF8
}

function Obtener-APIKey {
    $config = Leer-Config
    if ($config -and $config.APIKey) {
        return $config.APIKey
    } else {
        $apiKey = Read-Host "🔑 Ingresa tu API Key de DeepSeek (o presiona Enter para usar modo offline)"
        if ($apiKey) {
            $config = @{
                APIKey = $apiKey
                Idioma = "es"
                ModoAprendizaje = "activo"
            }
            Guardar-Config -Config $config
            return $apiKey
        } else {
            return $null
        }
    }
}

function Detectar-Idioma {
    param([string]$Texto)
    # Detección simple por caracteres comunes (puedes mejorarla con API)
    if ($Texto -match "[áéíóúñ]") { return "es" }
    if ($Texto -match "[äöüß]") { return "de" }
    if ($Texto -match "[çãõ]") { return "pt" }
    # Por defecto
    return "en"
}

function Consultar-DeepSeek {
    param([string]$Pregunta, [string]$Idioma = "es")
    $apiKey = Obtener-APIKey
    if (-not $apiKey) {
        return "⚠️ No hay API Key configurada. Usa la opción 5 para configurarla."
    }
    
    $url = "https://api.deepseek.com/v1/chat/completions"
    $headers = @{
        "Authorization" = "Bearer $apiKey"
        "Content-Type" = "application/json"
    }
    $body = @{
        model = "deepseek-chat"
        messages = @(
            @{ role = "system"; content = "Eres un asistente útil y creativo. Responde en el mismo idioma de la pregunta ($Idioma)." }
            @{ role = "user"; content = $Pregunta }
        )
        max_tokens = 500
        temperature = 0.7
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
        $respuesta = $response.choices[0].message.content
        return $respuesta
    } catch {
        Write-Log "Error al consultar DeepSeek: $_" "ERROR"
        return "⚠️ Error al obtener respuesta de DeepSeek. Revisa tu conexión o API Key."
    }
}

function Procesar-Pregunta {
    param([string]$Pregunta)
    $idioma = Detectar-Idioma -Texto $Pregunta
    Write-Log "Pregunta ($idioma): $Pregunta" "INFO"
    
    # Verificar si la pregunta es una acción (palabras clave)
    $acciones = @("crea", "genera", "automatiza", "haz", "escribe")
    $esAccion = $false
    foreach ($accion in $acciones) {
        if ($Pregunta -match $accion) {
            $esAccion = $true
            break
        }
    }
    
    if ($esAccion) {
        # Ejecutar tarea compleja (ej: crear un archivo, script, etc.)
        $respuesta = "🛠️ Ejecutando acción: '$Pregunta'...`n"
        $respuesta += "✅ Acción completada. (Este es un placeholder. Puedes personalizar las acciones)."
        Write-Log "Acción ejecutada: $Pregunta" "INFO"
        return $respuesta
    } else {
        # Consultar a DeepSeek
        $respuesta = Consultar-DeepSeek -Pregunta $Pregunta -Idioma $idioma
        return $respuesta
    }
}

function Reconocimiento-Voz {
    Write-Host "🎤 Escuchando... (di algo)"
    try {
        Add-Type -AssemblyName System.Speech
        $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
        $recognizer.SetInputToDefaultAudioDevice()
        $result = $recognizer.Recognize()
        if ($result) {
            return $result.Text
        } else {
            return $null
        }
    } catch {
        Write-Host "⚠️ No se pudo iniciar el reconocimiento de voz. Asegúrate de tener un micrófono." -ForegroundColor Red
        return $null
    }
}

function Mostrar-Historial {
    $logFile = Join-Path $carpetaLogs "interacciones.log"
    if (Test-Path $logFile) {
        Get-Content $logFile | Select-Object -Last 20 | ForEach-Object { Write-Host $_ }
    } else {
        Write-Host "No hay historial aún." -ForegroundColor Yellow
    }
}

function Mostrar-Estadisticas {
    $logFile = Join-Path $carpetaLogs "interacciones.log"
    if (Test-Path $logFile) {
        $lineas = Get-Content $logFile
        $total = $lineas.Count
        $preguntas = ($lineas | Select-String "Pregunta").Count
        $respuestas = ($lineas | Select-String "Respuesta").Count
        Write-Host "📊 ESTADÍSTICAS:" -ForegroundColor Cyan
        Write-Host "Total de interacciones: $total"
        Write-Host "Preguntas realizadas: $preguntas"
        Write-Host "Respuestas generadas: $respuestas"
    } else {
        Write-Host "No hay datos aún." -ForegroundColor Yellow
    }
}

function Configurar-APIKey {
    $nuevaKey = Read-Host "🔑 Ingresa tu nueva API Key de DeepSeek"
    if ($nuevaKey) {
        $config = Leer-Config
        if (-not $config) { $config = @{} }
        $config.APIKey = $nuevaKey
        Guardar-Config -Config $config
        Write-Host "✅ API Key actualizada." -ForegroundColor Green
    }
}

# --- MENÚ PRINCIPAL ---
function Mostrar-Menu {
    Clear-Host
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  🧠 AUTOMATIZADOR CHONGOKU - Sistema con IA DeepSeek" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "1. Hacer una pregunta (texto)" -ForegroundColor White
    Write-Host "2. Hacer una pregunta (voz)" -ForegroundColor White
    Write-Host "3. Ver historial de interacciones" -ForegroundColor White
    Write-Host "4. Ver estadísticas" -ForegroundColor White
    Write-Host "5. Configurar API Key" -ForegroundColor White
    Write-Host "6. Salir" -ForegroundColor White
    Write-Host "============================================================" -ForegroundColor Cyan
    $opcion = Read-Host "Elige una opción"
    return $opcion
}

# --- INTEGRACIÓN DE ZIP (buscar y descomprimir) ---
function Integrar-Modulos {
    $zips = @("burst.zip", "deepseek.zip")
    foreach ($zip in $zips) {
        $zipPath = Join-Path $escritorio $zip
        if (Test-Path $zipPath) {
            Write-Host "📦 Descomprimiendo $zip..." -ForegroundColor Yellow
            Expand-Archive -Path $zipPath -DestinationPath $carpetaModulos -Force
            Write-Host "✅ $zip integrado." -ForegroundColor Green
        } else {
            Write-Host "⚠️ No se encontró $zip. Creando módulo de ejemplo..." -ForegroundColor Yellow
            $moduloEjemplo = Join-Path $carpetaModulos "ejemplo.ps1"
            @"
# Módulo de ejemplo para $zip
function Ejecutar-Burst {
    Write-Host "🔥 Burst activado. Este es un ejemplo de módulo."
    # Aquí puedes poner tu lógica
}
"@ | Out-File -FilePath $moduloEjemplo -Encoding UTF8
        }
    }
    # Cargar módulos encontrados
    Get-ChildItem -Path $carpetaModulos -Filter "*.ps1" | ForEach-Object {
        . $_.FullName
        Write-Host "✅ Módulo cargado: $($_.Name)" -ForegroundColor Cyan
    }
}

# --- BUCLE PRINCIPAL ---
Integrar-Modulos

$salir = $false
while (-not $salir) {
    $opcion = Mostrar-Menu
    switch ($opcion) {
        "1" {
            $pregunta = Read-Host "✏️ Escribe tu pregunta"
            if ($pregunta) {
                $respuesta = Procesar-Pregunta -Pregunta $pregunta
                Write-Host "🤖 Respuesta:" -ForegroundColor Yellow
                Write-Host $respuesta -ForegroundColor White
                Write-Log "Respuesta: $respuesta" "INFO"
            }
            Read-Host "Presiona Enter para continuar"
        }
        "2" {
            $pregunta = Reconocimiento-Voz
            if ($pregunta) {
                Write-Host "🗣️ Dijiste: $pregunta" -ForegroundColor Cyan
                $respuesta = Procesar-Pregunta -Pregunta $pregunta
                Write-Host "🤖 Respuesta:" -ForegroundColor Yellow
                Write-Host $respuesta -ForegroundColor White
                Write-Log "Respuesta: $respuesta" "INFO"
            } else {
                Write-Host "❌ No te escuché. Intenta de nuevo." -ForegroundColor Red
            }
            Read-Host "Presiona Enter para continuar"
        }
        "3" {
            Mostrar-Historial
            Read-Host "Presiona Enter para continuar"
        }
        "4" {
            Mostrar-Estadisticas
            Read-Host "Presiona Enter para continuar"
        }
        "5" {
            Configurar-APIKey
            Read-Host "Presiona Enter para continuar"
        }
        "6" {
            $salir = $true
            Write-Host "🔥 Cerrando Automatizador Chongoku..." -ForegroundColor Green
        }
        default {
            Write-Host "❌ Opción no válida." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}
