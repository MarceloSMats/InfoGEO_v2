# Histórico de Alterações

Todas as mudanças notáveis no projeto InfoGEO serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [2.0.0] - 2025-01-16

### ✨ Adicionado
- **Módulo de Valoração Agronômica**
  - Cálculo automático de valor por hectare baseado em quadrantes
  - Integração com shapefile `Centroides_NtAgr_Valor`
  - Nota agronômica por classe de uso usando microregiões
  - Valor total consolidado da propriedade
  - Formatação de valores em padrão brasileiro (R$)

- **Integração SIGEF Completa**
  - Busca de imóveis por código SIGEF
  - Carregamento automático de geometria do shapefile SIGEF
  - Informações complementares do Excel SIGEF
  - Visualização de múltiplos registros para o mesmo código
  - Dados completos: proprietário, área, certificação, etc.

- **Suporte a Múltiplos Formatos**
  - Upload de arquivos KML/KMZ
  - Upload de arquivos GeoJSON
  - Upload de arquivos Shapefile (.shp ou .zip)
  - Conversão automática entre formatos

- **Desenho de Polígonos no Mapa**
  - Ferramenta de desenho integrada ao Leaflet
  - Criação de polígonos diretamente no mapa
  - Edição e exclusão de polígonos desenhados

- **Geração de Relatórios PDF**
  - Relatórios individuais por polígono
  - Relatório consolidado com todos os polígonos
  - Branding personalizado
  - Estatísticas detalhadas por classe de uso

- **Sistema de Configuração**
  - Arquivo `config.py` centralizando todas as configurações
  - Suporte a variáveis de ambiente via `.env`
  - Configuração de caminhos, portas, e funcionalidades

- **Scripts de Automação**
  - `instalar.bat` - Instalação automatizada para Windows
  - `iniciar.bat` - Script de inicialização do servidor
  - Verificação automática de dependências

- **Documentação Expandida**
  - `INICIO_RAPIDO.md` - Guia de 5 minutos
  - `COMPARTILHAMENTO.md` - Guia para distribuição
  - `ESTRUTURA_PROJETO.md` - Arquitetura detalhada
  - `.gitignore` - Controle de arquivos para Git
  - `CHANGELOG.md` - Este arquivo

### 🔧 Melhorado
- **Performance de Análise**
  - Método de pixel parcial otimizado para maior precisão
  - Processamento com Cloud Optimized GeoTIFF (COG)
  - Detecção automática de overviews para grandes áreas
  - Cache de shapefiles em memória

- **Interface do Usuário**
  - Controle de transparência da camada raster
  - Popups informativos aprimorados
  - Loading states durante processamento
  - Mensagens de erro mais descritivas

- **Validação de Dados**
  - Validação e correção automática de geometrias
  - Reprojeção automática para EPSG:4326
  - Verificação de integridade de arquivos

### 🐛 Corrigido
- Erro ao processar polígonos com geometrias inválidas
- Problema de encoding em nomes de arquivos com caracteres especiais
- Cálculo incorreto de área em sistemas de coordenadas projetados
- Memory leak em análises de grandes polígonos
- Conflitos de CORS em requisições AJAX

### 📖 Documentação
- README.md atualizado com todas as funcionalidades v2.0.0
- Exemplos de uso para cada formato de arquivo
- Guia de solução de problemas expandido
- Instruções de instalação para Windows/Linux/Mac

---

## [1.0.0] - 2024-XX-XX

### ✨ Versão Inicial
- Análise básica de uso do solo com arquivos KML
- Visualização no mapa Leaflet
- Cálculo de área por classe
- Exportação de resultados em tabela

---

## Legenda de Tipos de Mudança

- **✨ Adicionado**: Novas funcionalidades
- **🔧 Melhorado**: Melhorias em funcionalidades existentes
- **🐛 Corrigido**: Correções de bugs
- **📖 Documentação**: Mudanças na documentação
- **⚠️ Descontinuado**: Recursos que serão removidos em breve
- **🗑️ Removido**: Recursos removidos
- **🔒 Segurança**: Correções de segurança

---

## Planejamento Futuro

### [2.1.0] - Planejado
- [ ] Suporte a análise de séries temporais
- [ ] Exportação de resultados em Excel
- [ ] API REST documentada com Swagger
- [ ] Dashboard de estatísticas
- [ ] Suporte a múltiplos rasters simultâneos

### [2.2.0] - Em Consideração
- [ ] Autenticação e gestão de usuários
- [ ] Histórico de análises por usuário
- [ ] Compartilhamento de análises via link
- [ ] Integração com Google Earth Engine
- [ ] Análise de mudança temporal

### [3.0.0] - Visão de Longo Prazo
- [ ] Containerização com Docker
- [ ] Deploy automatizado
- [ ] Testes unitários e integração
- [ ] CI/CD com GitHub Actions
- [ ] Versão mobile responsiva
- [ ] Suporte multilíngue (PT/EN/ES)
