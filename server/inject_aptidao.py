def process_file():
    with open("js/app.js", "r", encoding="utf-8") as f:
        content = f.read()

    # 1. areaChart
    content = content.replace(
        "areaChartDeclividade: null,",
        "areaChartDeclividade: null,\n        areaChartAptidao: null,",
    )

    # 2. Resizing
    content = content.replace(
        "if (this.state.areaChartDeclividade) this.state.areaChartDeclividade.resize();",
        "if (this.state.areaChartDeclividade) this.state.areaChartDeclividade.resize();\n        if (this.state.areaChartAptidao) this.state.areaChartAptidao.resize();",
    )

    # 3. Opacity
    content = content.replace(
        "if (typeof DecliviDADE !== 'undefined' && DecliviDADE.state && DecliviDADE.state.currentLayer) {\n                DecliviDADE.state.currentLayer.setOpacity(parseFloat(e.target.value));\n            }",
        "if (typeof DecliviDADE !== 'undefined' && DecliviDADE.state && DecliviDADE.state.currentLayer) {\n                DecliviDADE.state.currentLayer.setOpacity(parseFloat(e.target.value));\n            }\n            if (typeof Aptidao !== 'undefined' && Aptidao.state && Aptidao.state.currentLayer) {\n                Aptidao.state.currentLayer.setOpacity(parseFloat(e.target.value));\n            }",
    )

    # 4. Buttons
    content = content.replace(
        "const btnAnalyzeDeclividade = document.getElementById('btnAnalyzeDeclividade');",
        "const btnAnalyzeDeclividade = document.getElementById('btnAnalyzeDeclividade');\n        const btnAnalyzeAptidao = document.getElementById('btnAnalyzeAptidao');",
    )
    content = content.replace(
        "if (btnAnalyzeDeclividade) {\n            btnAnalyzeDeclividade.disabled = !enabled;\n        }",
        "if (btnAnalyzeDeclividade) {\n            btnAnalyzeDeclividade.disabled = !enabled;\n        }\n        if (btnAnalyzeAptidao) {\n            btnAnalyzeAptidao.disabled = !enabled;\n        }",
    )

    # 5. applyTheme (around line 175)
    theme_declividade = """        // Atualizar gráfico de declividade se existir
        if (this.state.areaChartDeclividade) {
            if (this.state.areaChartDeclividade.options.plugins.legend) {
                this.state.areaChartDeclividade.options.plugins.legend.labels.color = legendColor;
            }

            if (this.state.areaChartDeclividade.options.plugins.tooltip) {
                this.state.areaChartDeclividade.options.plugins.tooltip.backgroundColor = tooltipBg;
                this.state.areaChartDeclividade.options.plugins.tooltip.titleColor = tooltipText;
                this.state.areaChartDeclividade.options.plugins.tooltip.bodyColor = tooltipText;
                this.state.areaChartDeclividade.options.plugins.tooltip.borderColor = tooltipBorder;
            }

            this.state.areaChartDeclividade.update();
        }"""
    theme_aptidao = theme_declividade.replace("Declividade", "Aptidao").replace(
        "declividade", "aptidao"
    )
    content = content.replace(
        theme_declividade, theme_declividade + "\n\n" + theme_aptidao
    )

    with open("js/app.js", "w", encoding="utf-8") as f:
        f.write(content)


process_file()
