@echo off
REM ============================================================================
REM Script de Instalação do InfoGEO - Windows
REM ============================================================================
REM Este script automatiza a configuração inicial da aplicação.
REM ============================================================================

echo.
echo ================================================================================
echo   INFOGEO - INSTALACAO AUTOMATICA
echo ================================================================================
echo.

REM Mudar para o diretório do script
cd /d "%~dp0"

REM Verificar Python
echo [1/6] Verificando instalacao do Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado!
    echo Por favor, instale Python 3.8 ou superior de https://www.python.org/
    pause
    exit /b 1
)
python --version
echo OK - Python encontrado!
echo.

REM Criar ambiente virtual
echo [2/6] Criando ambiente virtual...
if exist .venv (
    echo Ambiente virtual ja existe, pulando...
) else (
    python -m venv .venv
    echo OK - Ambiente virtual criado!
)
echo.

REM Ativar ambiente virtual
echo [3/6] Ativando ambiente virtual...
call .venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo [AVISO] Nao foi possivel ativar o ambiente virtual!
    echo          Continuando com Python global...
)
echo OK - Prosseguindo com instalacao!
echo.

REM Atualizar pip
echo [4/6] Atualizando pip...
python -m pip install --upgrade pip --quiet
echo OK - pip atualizado!
echo.

REM Instalar dependências
echo [5/6] Instalando dependencias (isso pode demorar alguns minutos)...
pip install -r server\requirements.txt
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao instalar dependencias!
    pause
    exit /b 1
)
echo OK - Todas as dependencias instaladas!
echo.

REM Criar arquivo .env se não existir
echo [6/6] Configurando arquivo de ambiente...
if not exist .env (
    copy .env.example .env >nul
    echo OK - Arquivo .env criado! Edite-o para personalizar configuracoes.
) else (
    echo Arquivo .env ja existe, mantendo configuracoes atuais.
)
echo.

REM Verificar estrutura de dados
echo ================================================================================
echo   VERIFICACAO DE ARQUIVOS DE DADOS
echo ================================================================================
echo.

if not exist "data\" (
    echo [AVISO] Pasta 'data' nao encontrada!
    mkdir data
    echo         Pasta 'data' criada. Copie seus arquivos .tif e shapefiles para la.
) else (
    echo OK - Pasta 'data' encontrada
)

if exist "data\LULC_VALORACAO_10m_com_mosaico.cog.tif" (
    echo OK - Raster principal encontrado
) else (
    echo [AVISO] Raster principal nao encontrado em data\
    echo         A aplicacao funcionara, mas sem dados raster.
)

if exist "data\Centroides_BR.geojson" (
    echo OK - GeoJSON de Valoracao encontrado
) else (
    echo [AVISO] GeoJSON de Valoracao nao encontrado
    echo         Modulo de valoracao desabilitado.
)

echo.
echo ================================================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ================================================================================
echo.
echo Para iniciar o servidor, execute:
echo   1. .venv\Scripts\activate
echo   2. python server\servidor.py
echo.
echo Ou simplesmente execute: iniciar.bat
echo.
echo Acesse a aplicacao em: http://localhost:5000
echo ================================================================================
echo.
pause
