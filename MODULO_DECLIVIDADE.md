# Módulo de Análise de Declividade - InfoGEO

## Visão Geral

O módulo de análise de declividade foi adicionado ao InfoGEO para processar e analisar dados de declividade de terreno usando o raster ALOS (Advanced Land Observing Satellite).

## Funcionalidades

### Backend (`servidor.py`)

1. **Classes de Declividade**: Definidas 7 classes de declividade baseadas em intervalos de porcentagem:
   - Classe 0: Sem classe (NoData/fora do raster)
   - Classe 1: 0-3% (Plano)
   - Classe 2: 3-8% (Suave Ondulado)
   - Classe 3: 8-20% (Ondulado)
   - Classe 4: 20-45% (Forte Ondulado)
   - Classe 5: 45-75% (Montanhoso)
   - Classe 6: >75% (Escarpado)

2. **Endpoint `/analisar-declividade`**:
   - Aceita os mesmos formatos de arquivo da análise de uso do solo (KML, KMZ, GeoJSON, Shapefile)
   - Processa o raster `ALOS_Declividade_Class_BR.tif` localizado na pasta `/data`
   - Retorna análise com área ocupada por cada classe de declividade

3. **Função `_process_declividade_sync()`**:
   - Reutiliza as funções existentes de processamento raster (`_fractional_stats`, `_convert_gdf_to_raster_crs`, etc.)
   - Calcula áreas e percentuais para cada classe de declividade
   - Gera imagem visualizada com cores específicas para cada classe

### Frontend

1. **JavaScript (`declividade-module.js`)**:
   - Módulo independente `DecliviDADE` com interface similar ao módulo de uso do solo
   - Suporta análise de múltiplos arquivos e polígonos desenhados
   - Exibe resultados em cards formatados com tabelas, imagens e metadados

2. **Interface (`index.html`)**:
   - Botão "Analisar Declividade" no painel lateral
   - Seção de resultados dedicada que aparece após a análise
   - Botão de limpar análise de declividade

3. **Estilos (`style.css`)**:
   - Cards específicos para resultados de declividade
   - Esquema de cores diferenciado (verde → amarelo → vermelho → roxo)
   - Suporte para temas claro e escuro

## Esquema de Cores

As cores foram escolhidas para representar visualmente o grau de inclinação:

- **Verde escuro (#2E7D32)**: Terreno plano (0-3%)
- **Verde claro (#66BB6A)**: Suave ondulado (3-8%)
- **Amarelo (#FDD835)**: Ondulado (8-20%)
- **Laranja (#FB8C00)**: Forte ondulado (20-45%)
- **Vermelho (#E53935)**: Montanhoso (45-75%)
- **Roxo (#8E24AA)**: Escarpado (>75%)

## Uso

1. **Carregar arquivo ou desenhar polígono**:
   - Utilize o upload de arquivo (KML, KMZ, GeoJSON, Shapefile)
   - Ou desenhe um polígono diretamente no mapa

2. **Executar análise**:
   - Clique no botão "Analisar Declividade"
   - Aguarde o processamento (pode demorar dependendo do tamanho do polígono)

3. **Visualizar resultados**:
   - A seção de resultados exibirá:
     - Área total do polígono
     - Número de classes encontradas
     - Tabela com área e percentual de cada classe
     - Mapa visual colorido da declividade
     - Metadados (centroide, município, UF, CRS)

## Arquivo Raster Requerido

O módulo requer o arquivo `ALOS_Declividade_Class_BR.tif` na pasta `/data`. Este arquivo deve conter:
- Classes de declividade já classificadas (valores de 1 a 6)
- Cobertura do território brasileiro
- Formato GeoTIFF compatível com rasterio

## Integração com o Sistema

O módulo foi integrado ao sistema existente:
- Reutiliza funções de processamento raster do módulo de uso do solo
- Compartilha a mesma lógica de upload e validação de arquivos
- Usa a mesma infraestrutura de GeoDataFrame e transformações de CRS
- Botões de análise habilitados/desabilitados sincronizados

## Diferenças em Relação à Análise de Uso do Solo

1. **Sem módulo de valoração**: A análise de declividade não calcula valores econômicos
2. **Classes diferentes**: 7 classes de declividade vs 11 classes de uso do solo
3. **Raster diferente**: Usa ALOS ao invés de MapBiomas
4. **Endpoint separado**: `/analisar-declividade` vs `/analisar`
5. **Resultados independentes**: Cada análise tem sua própria seção de resultados

## Melhorias Futuras Possíveis

- Exportação de resultados para PDF
- Gráficos de distribuição de classes
- Análise combinada uso do solo + declividade
- Cálculo de aptidão agrícola baseado em declividade
- Identificação automática de APPs por declividade
