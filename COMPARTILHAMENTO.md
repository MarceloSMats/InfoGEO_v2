# 📋 Guia de Compartilhamento do InfoGEO

Este guia ajuda a preparar e compartilhar o projeto InfoGEO com outras pessoas ou equipes.

---

## 🎯 Para Quem Vai Receber o Projeto

### Pré-requisitos

- **Python 3.8+** instalado ([Download aqui](https://www.python.org/downloads/))
- **Git** (opcional, para clonar o repositório)
- **Navegador moderno** (Chrome, Firefox, Edge)

### Instalação Rápida (Windows)

1. **Baixe ou clone o projeto**
   ```bash
   git clone <url-do-repositorio>
   cd InfoGEO
   ```

2. **Execute o instalador**
   ```bash
   instalar.bat
   ```

3. **Inicie o servidor**
   ```bash
   iniciar.bat
   ```

4. **Acesse no navegador**
   ```
   http://localhost:5000
   ```

### Instalação Manual

Se preferir instalar manualmente ou estiver usando Linux/Mac:

```bash
# 1. Criar ambiente virtual
python -m venv .venv

# 2. Ativar ambiente virtual
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# 3. Instalar dependências
pip install -r server/requirements.txt

# 4. Iniciar servidor
python server/servidor.py
```

---

## 📦 Preparando para Compartilhar

### 1. Checklist de Arquivos Necessários

**✅ Incluir sempre:**
- [ ] Todo o código fonte (`js/`, `css/`, `server/`, `index.html`)
- [ ] `requirements.txt` com todas as dependências
- [ ] `config.py` (arquivo de configuração)
- [ ] `.env.example` (exemplo de variáveis de ambiente)
- [ ] `README.md` (documentação principal)
- [ ] Scripts de automação (`instalar.bat`, `iniciar.bat`)
- [ ] `.gitignore` (para evitar commits desnecessários)

**⚠️ Arquivos Grandes - Orientar sobre Download Separado:**
- [ ] `data/*.tif` (rasters - geralmente >500MB)
- [ ] `data/*.shp` e arquivos associados (shapefiles)
- [ ] `data/*.xlsx` (planilhas complementares)

**❌ NUNCA incluir:**
- [ ] `.venv/` (ambiente virtual - será criado na instalação)
- [ ] `__pycache__/` (cache Python)
- [ ] `.env` (configurações locais)
- [ ] `logs/` (arquivos de log)

### 2. Estrutura de Dados Recomendada

Oriente os usuários a organizarem os dados assim:

```
InfoGEO/
├── data/
│   ├── LULC_VALORACAO_10m_com_mosaico.cog.tif  # Raster principal
│   ├── Centroides_BR.geojson                    # GeoJSON Valoração
│   └── CD_MICRO_CLASSES.xlsx                    # Excel complementar
```

### 3. Documentar Downloads Externos

Crie uma seção no README indicando onde baixar dados grandes:

```markdown
## 📥 Download de Dados

Os arquivos de dados não estão incluídos no repositório devido ao tamanho.
Baixe-os separadamente:

- **Raster LULC**: [Link para download]
- **Shapefile Valoração**: [Link para download]

Depois de baixar, coloque na pasta `data/` seguindo a estrutura indicada.
```

---

## 🔧 Configurações Personalizáveis

### Arquivo `.env`

Copie `.env.example` para `.env` e personalize:

```bash
# Porta do servidor (padrão: 5000)
INFOGEO_PORT=8080

# Habilitar modo debug
INFOGEO_DEBUG=False

# Caminho customizado do raster
INFOGEO_RASTER_PATH=D:/MeusDados/raster.tif
```

### Arquivo `config.py`

Todas as configurações hardcoded foram centralizadas aqui. Edite para ajustar:
- Caminhos de arquivos
- Classes de uso do solo
- Cores dos mapas
- Configurações de logging

---

## 📤 Opções de Compartilhamento

### Opção 1: Repositório Git (Recomendado)

```bash
# 1. Criar repositório no GitHub/GitLab
# 2. Adicionar .gitignore apropriado
# 3. Fazer commit e push

git init
git add .
git commit -m "Versão inicial do InfoGEO"
git remote add origin <url-do-repositorio>
git push -u origin main
```

### Opção 2: Arquivo ZIP

1. Excluir pastas desnecessárias:
   - `.venv/`
   - `__pycache__/`
   - `data/` (opcional - pode ser muito grande)
   - `logs/`

2. Compactar o restante

3. Incluir arquivo `LEIA-ME.txt` com instruções básicas

### Opção 3: Docker (Avançado)

Para distribuição mais profissional, considere criar um `Dockerfile`:

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["python", "server/servidor.py"]
```

---

## 🐛 Problemas Comuns ao Compartilhar

### 1. "Python não encontrado"
**Solução:** Usuário precisa instalar Python e adicionar ao PATH

### 2. "Erro ao instalar dependências"
**Solução:** 
```bash
# Atualizar pip primeiro
python -m pip install --upgrade pip
pip install -r server/requirements.txt
```

### 3. "Permissão negada ao executar .bat"
**Solução (PowerShell como Admin):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### 4. "Raster não encontrado"
**Solução:** Verificar se dados estão na pasta `data/` correta

### 5. "Porta 5000 já em uso"
**Solução:** Alterar porta no `.env`:
```
INFOGEO_PORT=8080
```

---

## 📝 Checklist Final Antes de Compartilhar

- [ ] README.md atualizado com instruções claras
- [ ] `requirements.txt` com todas as dependências
- [ ] Scripts de instalação testados (`instalar.bat`)
- [ ] `.gitignore` configurado corretamente
- [ ] `.env.example` criado com todas as variáveis
- [ ] Documentação sobre onde baixar dados grandes
- [ ] Código comentado em partes críticas
- [ ] Testado em máquina limpa (sem dependências instaladas)
- [ ] Licença de uso definida (se aplicável)

---

## 🆘 Suporte

Se os usuários tiverem problemas, oriente-os a:

1. Verificar se Python 3.8+ está instalado
2. Ler mensagens de erro completas
3. Consultar seção "Solução de Problemas" no README
4. Verificar se todos os arquivos de dados estão presentes

---

## 🎓 Boas Práticas para Manutenibilidade

### 1. Versionamento Semântico
- `v2.0.0` - Versão atual
- `v2.1.0` - Novas funcionalidades
- `v2.0.1` - Correções de bugs

### 2. CHANGELOG
Mantenha um arquivo `CHANGELOG.md`:

```markdown
## [2.0.0] - 2025-01-16
### Adicionado
- Módulo de valoração agronômica
- Suporte a múltiplos formatos (KML, GeoJSON, SHP)

### Corrigido
- Erro ao processar polígonos muito grandes
```

### 3. Testes
Considere adicionar testes básicos:

```bash
# Testar se servidor inicia
python server/servidor.py &
curl http://localhost:5000

# Testar importações
python -c "import rasterio, geopandas, shapely"
```

---

## 🚀 Próximos Passos

Para tornar ainda mais profissional:

1. **CI/CD**: Automatizar testes com GitHub Actions
2. **Docker Compose**: Incluir todos os serviços necessários
3. **Documentação Online**: Hospedar docs em ReadTheDocs ou GitHub Pages
4. **Releases**: Criar releases no GitHub com arquivos compilados
5. **Testes Unitários**: Adicionar pytest para funções críticas

---

**Dica Final:** Teste a instalação em uma máquina limpa (ou container Docker) antes de compartilhar oficialmente!
