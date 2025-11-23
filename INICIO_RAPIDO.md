# 🚀 InfoGEO - Início Rápido (5 minutos)

## ⚡ Instalação Express

### Windows
```bash
# 1. Baixe o projeto
# 2. Execute no prompt de comando:
instalar.bat

# 3. Inicie o servidor:
iniciar.bat

# 4. Abra no navegador:
http://localhost:5000
```

### Linux/Mac
```bash
# 1. Crie ambiente virtual
python3 -m venv .venv
source .venv/bin/activate

# 2. Instale dependências
pip install -r server/requirements.txt

# 3. Inicie servidor
python server/servidor.py
```

---

## 📁 Onde Colocar os Dados

```
InfoGEO/
└── data/
    ├── LULC_VALORACAO_10m_com_mosaico.cog.tif  ← Seu arquivo raster aqui
    ├── SIGEF_AMOSTRA/                           ← Shapefiles SIGEF aqui
    └── Centroides_NtAgr_Valor/                  ← Shapefiles de valoração aqui
```

---

## 🎯 Uso Básico

1. **Arraste arquivo KML/KMZ/GeoJSON** na área de upload
2. **Clique em "Analisar"**
3. **Visualize resultados** no mapa e tabela
4. **(Opcional)** Ative "Valoração" para análise agronômica

---

## 🐛 Problemas?

| Erro | Solução |
|------|---------|
| "Python não encontrado" | Instale Python 3.8+ |
| "Porta 5000 em uso" | Edite `.env` e mude `INFOGEO_PORT=8080` |
| "Raster não encontrado" | Coloque arquivo .tif na pasta `data/` |

---

## 📚 Mais Informações

- **Documentação completa:** `README.md`
- **Guia de compartilhamento:** `COMPARTILHAMENTO.md`
- **Configurações:** `config.py` e `.env`

---

**Pronto!** 🎉 Você já pode usar o InfoGEO.
