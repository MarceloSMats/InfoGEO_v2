@echo off
REM ============================================================================
REM Script de Inicialização do InfoGEO - Windows
REM ============================================================================

echo.
echo ================================================================================
echo   INICIANDO INFOGEO...
echo ================================================================================
echo.

REM Verificar se ambiente virtual existe
if not exist .venv (
    echo [ERRO] Ambiente virtual nao encontrado!
    echo Por favor, execute 'instalar.bat' primeiro.
    echo.
    pause
    exit /b 1
)

REM Ativar ambiente virtual
call .venv\Scripts\activate.bat

REM Verificar se ativação funcionou
if %errorlevel% neq 0 (
    echo [ERRO] Nao foi possivel ativar o ambiente virtual!
    echo.
    echo Tente executar no PowerShell como Administrador:
    echo   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
    echo.
    pause
    exit /b 1
)

REM Iniciar servidor
echo Iniciando servidor Flask...
echo.
python server\servidor.py

REM Manter janela aberta se houver erro
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] O servidor encontrou um problema!
    pause
)
