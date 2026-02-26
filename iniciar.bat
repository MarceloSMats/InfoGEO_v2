@echo off
REM ============================================================================
REM Script de Inicialização do InfoGEO - Windows
REM ============================================================================

echo.
echo ================================================================================
echo   INICIANDO INFOGEO...
echo ================================================================================
echo.

REM Mudar para o diretório do script
cd /d "%~dp0"

REM Verificar Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado!
    echo Por favor, instale Python 3.8 ou superior de https://www.python.org/
    echo.
    pause
    exit /b 1
)

REM Verificar se ambiente virtual existe
if not exist .venv (
    echo [ERRO] Ambiente virtual nao encontrado!
    echo Por favor, execute 'executar_InfoGEO.bat' ou 'instalar.bat' primeiro.
    echo.
    pause
    exit /b 1
)

REM Ativar ambiente virtual
call .venv\Scripts\activate.bat

REM Verificar se ativação funcionou
if %errorlevel% neq 0 (
    echo [AVISO] Nao foi possivel ativar o ambiente virtual!
    echo         Tentando usar Python global...
    echo.
)

REM Iniciar servidor
echo Iniciando servidor Flask...
echo Acesse: http://localhost:5000
echo.
python server\servidor.py

REM Manter janela aberta se houver erro
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] O servidor encontrou um problema!
    pause
)
