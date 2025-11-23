# InfoGEO - Sistema Avançado de Análise de Uso do Solo

Sistema web completo para análise geoespacial de uso do solo baseado em arquivos KML/GeoJSON/Shapefile e imagens raster, com suporte a múltiplos polígonos, processamento individualizado e módulo de valoração agronômica.

---

## 📚 Documentação

- **[Início Rápido (5 minutos)](INICIO_RAPIDO.md)** - Instalação e uso básico
- **[Guia de Compartilhamento](COMPARTILHAMENTO.md)** - Como distribuir o projeto
- **[Estrutura do Projeto](ESTRUTURA_PROJETO.md)** - Arquitetura e organização
- **[README Completo](#)** - Este arquivo (documentação detalhada)

---

## 🚀 Funcionalidades Principais

### 📂 Importação de Dados Geoespaciais
- ✅ Upload de arquivos **KML** (com suporte a KMZ compactado)
- ✅ Upload de arquivos **GeoJSON**
- ✅ Upload de arquivos **Shapefile** (.shp ou .zip com todos os componentes)
- ✅ Processamento individual de cada polígono em arquivos multi-feature
- ✅ Validação e correção automática de geometrias
- ✅ Suporte a múltiplos sistemas de coordenadas (conversão automática)

### 🗺️ Visualização e Interação
- ✅ Visualização interativa no mapa com **Leaflet**
- ✅ **Desenho de polígonos diretamente no mapa** com ferramenta dedicada
- ✅ **Busca por código de imóvel SIGEF** com visualização automática no mapa
- ✅ Controle de transparência da camada raster
- ✅ Zoom automático para área de interesse
- ✅ Popups informativos com coordenadas e dados do polígono
- ✅ Suporte a camadas base (OpenStreetMap, Satélite)

### 📊 Análise de Uso do Solo
- ✅ Análise detalhada com recorte preciso por polígono
- ✅ Cálculo de área total e por classe de uso
- ✅ Distribuição percentual automática
- ✅ **Método de pixel parcial otimizado** para maior precisão
- ✅ Suporte a raster padrão do sistema ou personalizado
- ✅ Processamento otimizado com **Cloud Optimized GeoTIFF (COG)**
- ✅ Detecção automática de overviews para grandes áreas

### 💰 Módulo de Valoração Agronômica (NOVO!)
- ✅ **Cálculo automático de valor por hectare** baseado em quadrantes
- ✅ Integração com shapefile de **Centroides_NtAgr_Valor**
- ✅ **Nota agronômica por classe de uso** usando microregiões
- ✅ **Valor total da propriedade** consolidado
- ✅ Formatação de valores em padrão brasileiro (R$)
- ✅ Informações detalhadas: código do quadrante, valor/ha, nota agronômica

### 🔍 Integração SIGEF
- ✅ **Busca de imóveis por código SIGEF**
- ✅ Carregamento automático de geometria do shapefile SIGEF
- ✅ **Informações complementares do Excel SIGEF** (quando disponível)
- ✅ Visualização de múltiplos registros para o mesmo código
- ✅ Dados completos: proprietário, área, certificação, etc.

### 📄 Geração de Relatórios
- ✅ **Relatórios PDF profissionais** com branding personalizado
- ✅ Relatórios individuais por polígono
- ✅ **Relatório consolidado** com todos os polígonos
- ✅ Gráficos de pizza para distribuição de classes
- ✅ Tabelas formatadas com dados de valoração
- ✅ Mapa de localização incluído
- ✅ Informações de geolocalização (município, UF)
- ✅ Coordenadas em formato DMS (graus, minutos, segundos)

### 📤 Exportação de Dados
- ✅ Export de polígonos desenhados para **KML**
- ✅ Export de relatórios em **PDF**
- ✅ Export de dados tabulares
- ✅ Imagens PNG com recorte da análise

### 🎨 Interface Moderna
- ✅ Design responsivo com **tema escuro/claro**
- ✅ Painel lateral expansível e colapsável
- ✅ Atalhos de teclado para operações comuns
- ✅ Histórico de buscas SIGEF
- ✅ Feedback visual e animações suaves
- ✅ Suporte mobile e desktop

## 📋 Pré-requisitos

- **Python 3.8+**
- **GDAL/OGR** (com suporte a Shapefile)
- Navegador web moderno (Chrome, Firefox, Edge)

### Instalação do GDAL

**Windows (recomendado com conda):**
```bash
conda install -c conda-forge gdal
```

**Windows (com pip):**
```bash
pip install GDAL
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install gdal-bin python3-gdal
```

**macOS (com Homebrew):**
```bash
brew install gdal
```

## 🛠️ Instalação

1. **Clone o repositório:**
```bash
git clone <url-do-repositorio>
cd InfoGEO
```

2. **Crie um ambiente virtual (recomendado):**
```bash
python -m venv venv
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate     # Windows
```

3. **Instale as dependências Python:**
```bash
cd server
pip install -r requirements.txt
```

4. **Configure os dados necessários:**

   Estrutura de diretórios `data/`:
   ```
   data/
   ├── LULC_VALORACAO_10m_com_mosaico.cog.tif  # Raster principal
   ├── Centroides_NtAgr_Valor/                 # Shapefile de valoração
   │   └── Centroides_NtAgr_Valor.shp
   ├── SIGEF_AMOSTRA/                          # Shapefile SIGEF
   │   └── SIGEF_APENAS_AMOSTRAS_062025.shp
   ├── SIGEF_AMOSTRA.xlsx                      # Excel complementar SIGEF
   └── CD_MICRO_CLASSES.xlsx                   # Notas agronômicas
   ```

5. **Execute o servidor:**
```bash
cd server
python servidor.py
```

6. **Acesse a aplicação:**
   - Abra http://localhost:5000 no navegador

## 📁 Estrutura do Projeto

```
InfoGEO/
├── server/
│   ├── servidor.py          # Servidor Flask principal
│   └── requirements.txt     # Dependências Python
├── data/                    # Dados geoespaciais
│   ├── *.tif               # Rasters (COG)
│   ├── Centroides_NtAgr_Valor/
│   ├── SIGEF_AMOSTRA/
│   └── *.xlsx              # Planilhas complementares
├── css/
│   └── style.css           # Estilos modernos da interface
├── js/
│   ├── app.js              # Aplicação principal
│   ├── map.js              # Gerenciamento do mapa Leaflet
│   ├── utils.js            # Utilitários e funções auxiliares
│   ├── valoracao.js        # Módulo de valoração agronômica
│   └── pdf-generator.js    # Geração de relatórios PDF
├── images/                 # Assets visuais
└── index.html              # Interface principal
```

## 🎯 Como Usar

### 1. Carregamento de Polígonos

**Opção A: Upload de arquivos**
- Clique em "📂 Carregar Arquivo"
- Formatos aceitos: `.kml`, `.kmz`, `.geojson`, `.json`, `.shp`, `.zip`
- Múltiplos polígonos são processados individualmente

**Opção B: Desenho direto no mapa**
- Clique em "✏️ Desenhar Polígono"
- Clique no mapa para adicionar vértices
- Duplo clique para finalizar
- Use "📥 Exportar KML" para salvar

**Opção C: Busca por código SIGEF**
- Digite o código do imóvel no campo de busca
- Clique em "🔍 Buscar SIGEF"
- O polígono será carregado automaticamente

### 2. Seleção do Tipo de Raster

- **Raster Padrão (com mosaico):** Inclui dados de valoração
- **Raster Sem Mosaico:** Apenas classificação de uso do solo
- **Raster Personalizado:** Upload de arquivo TIFF próprio

### 3. Análise de Uso do Solo

1. Carregue ou desenhe polígonos
2. Selecione o tipo de raster
3. **Marque/desmarque "Habilitar Módulo de Valoração"** conforme necessário
4. Clique em "🔬 Analisar Uso do Solo"
5. Aguarde o processamento
6. Visualize os resultados no painel lateral

### 4. Visualização de Resultados

**Para múltiplos polígonos:**
- Use "Selecionar Polígono" para alternar entre eles
- "Todos os polígonos" mostra resultados consolidados

**Informações disponíveis:**
- 📐 Área total e por classe (ha e %)
- 💰 Valor total da propriedade (se valoração ativada)
- 📊 Código do quadrante e valor/ha
- 🎓 Nota agronômica por classe
- 🗺️ Coordenadas do centroide (DMS e decimal)
- 📍 Localização (município e UF)
- 🖼️ Imagem recortada com classes coloridas
- 📈 Gráficos interativos

### 5. Geração de Relatórios

**Relatório Individual:**
- Selecione um polígono
- Clique em "📄 Gerar PDF"

**Relatório Consolidado:**
- Selecione "Todos os polígonos"
- Clique em "📄 Gerar PDF Consolidado"

**Conteúdo dos relatórios:**
- Cabeçalho com logo e informações
- Dados de localização completos
- Tabela de distribuição de classes
- Informações de valoração (se habilitada)
- Gráfico de pizza
- Mapa de localização

## 🗂️ Formatos Suportados

### Entrada
| Tipo | Formatos | Notas |
|------|----------|-------|
| Polígonos | `.kml`, `.kmz`, `.geojson`, `.json` | Multi-feature suportado |
| Shapefile | `.shp` + auxiliares ou `.zip` | Requer .dbf, .shx, .prj |
| Raster | `.tif`, `.tiff` (GeoTIFF) | Preferível COG para performance |

### Saída
- **PDF** - Relatórios profissionais
- **KML** - Polígonos desenhados
- **PNG** - Imagens de análise
- **JSON** - Dados estruturados (via API)

## 🎨 Classes de Uso do Solo

| Código | Descrição | Cor | Uso Típico |
|--------|-----------|-----|------------|
| 1 | Lavoura Anual | 🟣 #c27ba0 | Soja, milho, trigo |
| 2 | Lavoura Perene | 🟣 #9932cc | Café, cana, fruticultura |
| 3 | Pastagem Cultivada | 🟡 #edde8e | Braquiária, capim |
| 4 | Pastagem Nativa | 🟡 #d6bc74 | Campo nativo |
| 5 | Pastagem Degradada | 🔴 #d4271e | Necessita recuperação |
| 6 | Silvicultura (Comercial) | 🟤 #7a5900 | Eucalipto, pinus |
| 8 | Área de preservação | 🟢 #1f8d49 | RL, APP, mata nativa |
| 9 | Lagos, lagoas | 🔵 #2532e4 | Corpos d'água |
| 10 | Construções e Benfeitorias | ⚫ #5e5e5e | Edificações, estradas |
| 100 | Uso Agropecuário não Definido | ⚫ #000000 | Indefinido |

## 💡 Recursos Avançados

### Módulo de Valoração

O sistema calcula automaticamente:

1. **Valor por hectare:** Baseado no quadrante onde o imóvel está localizado
2. **Nota agronômica:** Para cada classe de uso, considerando a microregião
3. **Valor total:** Somando todas as classes ponderadas

**Fontes de dados:**
- Shapefile `Centroides_NtAgr_Valor` - valores de quadrante
- Excel `CD_MICRO_CLASSES` - notas agronômicas por microregião

### Integração SIGEF

Busca e visualiza imóveis do SIGEF:
- Por código do imóvel
- Carrega geometria do shapefile
- Complementa com dados do Excel (proprietário, área, etc.)
- Suporta múltiplos registros para o mesmo código

### Otimizações de Performance

- **COG (Cloud Optimized GeoTIFF):** Leitura otimizada de grandes rasters
- **Overviews:** Uso automático para áreas extensas
- **Cache de dados:** Shapefiles mantidos em memória
- **Processamento assíncrono:** Análises não bloqueantes

## 🔧 Configuração Avançada

### Variáveis de Ambiente

```bash
# Caminho para o raster padrão
export LULC_TIFF_PATH=/caminho/para/raster.tif

# Chave secreta (se implementar autenticação)
export SECRET_KEY=sua-chave-secreta-aqui

# Modo de desenvolvimento
export FLASK_DEBUG=True
export FLASK_ENV=development
```

### Personalização de Interface

**Trocar tema:**
- Botão "🌙/☀️" no canto superior direito

**Modificar cores das classes:**
Edite `UTILS.CLASSES_CORES` em `js/utils.js`

**Ajustar transparência:**
Use o controle deslizante "Opacidade da Imagem"

## 🐛 Solução de Problemas

### Arquivo não carrega

**KML/GeoJSON:**
- ✅ Valide o arquivo em um validador online
- ✅ Verifique se contém polígonos (não apenas pontos/linhas)
- ✅ Tente com arquivo de exemplo

**Shapefile:**
- ✅ Comprima TODOS os arquivos (.shp, .dbf, .shx, .prj) em um .zip
- ✅ Ou faça upload apenas do .zip

### Raster não encontrado
- ✅ Verifique caminho em `LULC_TIFF_PATH`
- ✅ Confirme que arquivo existe em `data/`
- ✅ Teste permissões de leitura

### Valoração não funciona
- ✅ Confirme que shapefiles estão em `data/Centroides_NtAgr_Valor/`
- ✅ Verifique se Excel `CD_MICRO_CLASSES.xlsx` existe
- ✅ Marque "Habilitar Módulo de Valoração"

### Busca SIGEF sem resultados
- ✅ Verifique se shapefile SIGEF está em `data/SIGEF_AMOSTRA/`
- ✅ Confira o código digitado
- ✅ Veja log do servidor para erros

### Erro ao gerar PDF
- ✅ Aguarde conclusão da análise antes de gerar PDF
- ✅ Limpe cache do navegador
- ✅ Tente com navegador diferente

## 📊 Método de Análise

O sistema utiliza **"Pixel Parcial Otimizado"**:

1. **Pixels internos:** Contagem completa (fração = 1.0)
2. **Pixels de borda:** Cálculo de fração de interseção com polígono
3. **Área total:** Soma de pixels × área_pixel × fração
4. **Compatibilidade:** Funciona com qualquer CRS (conversão automática para UTM)

**Vantagens:**
- ✅ Alta precisão na estimativa de área
- ✅ Considera pixels parcialmente cobertos
- ✅ Resultados consistentes independente da resolução

## 🆕 Histórico de Versões

### v2.0.0 (Atual) - Novembro 2025
- ✨ **NOVO:** Módulo completo de valoração agronômica
- ✨ **NOVO:** Integração SIGEF com busca por código
- ✨ **NOVO:** Suporte a Shapefile (.shp e .zip)
- ✨ **NOVO:** Suporte a GeoJSON nativo
- ✨ **NOVO:** Geolocalização reversa (município/UF)
- ✨ **NOVO:** Coordenadas em formato DMS
- ✨ **NOVO:** Relatórios PDF aprimorados com valoração
- ✨ **NOVO:** Otimizações COG para grandes rasters
- ✨ **NOVO:** Atalhos de teclado
- ✨ **NOVO:** Histórico de buscas SIGEF
- 🔧 Melhorias na interface responsiva
- 🔧 Performance otimizada para múltiplos polígonos
- 🐛 Correções de bugs diversos

### v1.1.0
- Suporte a múltiplos polígonos em um único KML
- Processamento individual para cada polígono
- Interface aprimorada para seleção de polígonos
- Melhorias de performance e estabilidade

### v1.0.0
- Versão inicial
- Suporte a polígonos únicos
- Funcionalidades básicas de análise

## 📞 Suporte

Para reportar bugs ou solicitar funcionalidades:

1. Verifique a documentação completa
2. Consulte as issues no repositório
3. Crie uma nova issue com:
   - Descrição clara do problema
   - Passos para reproduzir
   - Prints/logs quando relevante
   - Informações do ambiente (OS, Python, navegador)

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob licença proprietária. Todos os direitos reservados.

---

**InfoGEO - Sistema Avançado de Análise de Uso do Solo** © 2024-2025
*Desenvolvido para análise geoespacial profissional com módulo de valoração agronômica*
 
📋 Pré-requisitos
 
· Python 3.8+
· GDAL (veja instruções de instalação abaixo)
· Navegador web moderno
 
Instalação do GDAL
 
Windows (recomendado com conda):
 
```bash
conda install -c conda-forge gdal
```
 
Windows (com pip):
 
```bash
pip install GDAL
```
 
Linux (Ubuntu/Debian):
 
```bash
sudo apt-get update
sudo apt-get install gdal-bin python3-gdal
```
 
Linux (CentOS/RHEL):
 
```bash
sudo yum install gdal gdal-devel
```
 
macOS (com Homebrew):
 
```bash
brew install gdal
```
 
🛠️ Instalação
 
1. Clone o repositório:
 
```bash
git clone <url-do-repositorio>
cd InfoGEO
```
 
1. Crie um ambiente virtual (opcional, mas recomendado):
 
```bash
python -m venv venv
source venv/bin/activate  # Linux/macOS
venv\Scripts\activate     # Windows
```
 
1. Instale as dependências Python:
 
```bash
pip install -r requirements.txt
```
 
1. Configure o arquivo raster padrão:
   · Coloque o arquivo TIFF em data/LULC_VALORACAO_10m_com_mosaico.tif
   · Ou defina a variável de ambiente:
   ```bash
   export LULC_TIFF_PATH=/caminho/para/seu/raster.tif
   ```
2. Execute o servidor:
 
```bash
python servidor.py
```
 
1. Acesse a aplicação:
   Abra http://localhost:5000 no navegador
 
📁 Estrutura do Projeto
 
```
InfoGEO/
├── servidor.py              # Servidor Flask principal
├── requirements.txt         # Dependências Python
├── data/                   # Dados raster (TIFF files)
│   └── LULC_VALORACAO_10m_com_mosaico.tif
├── css/
│   └── style.css           # Estilos da interface
├── js/
│   ├── app.js              # Aplicação principal
│   ├── map.js              # Gerenciamento do mapa
│   ├── utils.js            # Utilitários gerais
│   └── pdf-generator.js    # Geração de relatórios PDF
├── images/                 # Imagens e logos
└── index.html              # Interface principal
```
 
🎯 Como Usar
 
1. Carregamento de Polígonos
 
Opção A: Upload de arquivo KML
 
· Clique em "Solte aqui ou selecione arquivos KML"
· Selecione um ou mais arquivos KML
· Cada polígono no KML será processado individualmente
 
Opção B: Desenho direto no mapa
 
· Clique em "✏️ Desenhar Polígono"
· Clique no mapa para adicionar vértices
· Duplo clique para finalizar o polígono
· Use "📥 Exportar KML" para salvar
 
2. Configuração do Raster
 
Raster Padrão:
 
· Usa o raster do sistema pré-configurado
 
Raster Personalizado:
 
· Selecione "Raster Personalizado"
· Faça upload de um arquivo TIFF
· O raster será usado para todas as análises
 
3. Análise de Uso do Solo
 
1. Carregue os polígonos (KML ou desenho)
2. Clique em "Analisar Uso do Solo"
3. Aguarde o processamento (cada polígono é analisado individualmente)
4. Visualize os resultados no painel lateral
 
4. Visualização de Resultados
 
Para múltiplos polígonos:
 
· Use o seletor "Selecionar Polígono" para alternar entre eles
· "Todos os polígonos" mostra resultados consolidados
 
Informações disponíveis:
 
· Área total e por classe de uso
· Distribuição percentual
· Metadados do raster
· Imagem recortada do uso do solo
· Gráficos interativos
 
5. Exportação de Resultados
 
Relatório PDF Individual:
 
· Gera relatório detalhado para o polígono selecionado
 
Relatório PDF Consolidado:
 
· Gera relatório completo com todos os polígonos
 
Exportar KML:
 
· Exporta polígonos desenhados para KML
 
🗂️ Formatos Suportados
 
Entrada:
 
· KML (Keyhole Markup Language) com polígonos
· TIFF/GeoTIFF para raster
 
Saída:
 
· PDF (relatórios)
· KML (polígonos desenhados)
· Visualização interativa no mapa
 
🎨 Classes de Uso do Solo
 
O sistema reconhece as seguintes classes:
 
Código Descrição Cor
1 Lavoura Anual #c27ba0
2 Lavoura Perene #9932cc
3 Pastagem Cultivada #edde8e
4 Pastagem Nativa #d6bc74
5 Pastagem Degradada #d4271e
6 Silvicultura (Comercial) #7a5900
8 Área de preservação (RL,APP) #1f8d49
9 Lagos, lagoas #2532e4
10 Construções e Benfeitorias #5e5e5e
100 Uso Agropecuário não Definido #000000
 
🔧 Configuração Avançada
 
Variáveis de Ambiente
 
```bash
# Caminho para o raster padrão
export LULC_TIFF_PATH=/caminho/para/raster.tif
 
# Modo de desenvolvimento
export FLASK_DEBUG=True
export FLASK_ENV=development
```
 
Personalização de Cores
 
Edite UTILS.CLASSES_CORES em utils.js para alterar as cores das classes:
 
```javascript
CLASSES_CORES: {
    1: "#c27ba0",
    2: "#9932cc",
    // ... outras classes
}
```
 
🐛 Solução de Problemas
 
KML não carrega
 
· Verifique se o arquivo KML é válido
· Confirme que contém polígonos
· Teste com o KML de exemplo fornecido
 
Raster não encontrado
 
· Verifique o caminho em LULC_TIFF_PATH
· Confirme que o arquivo TIFF existe
· Teste permissões de leitura
 
Erro 304 (Cache)
 
· Limpe o cache do navegador
· Reinicie o servidor Flask
· Use Ctrl+F5 para recarregar forçado
 
Mapa não carrega
 
· Verifique conexão com internet (para tiles)
· Confirme que Leaflet carregou corretamente
· Verifique console do navegador para erros
 
📊 Métodos de Análise
 
O sistema utiliza o método "Pixel Parcial Otimizado":
 
· Pixels internos ao polígono: contagem completa
· Pixels na borda: cálculo de fração de interseção
· Alta precisão na estimativa de área
· Compatível com diferentes sistemas de coordenadas
 
🆕 Histórico de Versões
 
v1.1.0 (Atual)
 
· Suporte a múltiplos polígonos em um único KML
· Processamento individual para cada polígono
· Interface aprimorada para seleção de polígonos
· Melhorias de performance e estabilidade
 
v1.0.0
 
· Versão inicial
· Suporte a polígonos únicos
· Funcionalidades básicas de análise
 
📞 Suporte
 
Para reportar bugs ou solicitar funcionalidades:
 
1. Verifique a documentação
2. Consulte as issues no repositório
3. Crie uma nova issue com detalhes do problema
 
---
 
InfoGEO - Sistema de Análise de Uso do Solo © 2024