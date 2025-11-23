# 🤝 Contribuindo para o InfoGEO

Obrigado pelo interesse em contribuir! Este documento fornece diretrizes para contribuições ao projeto.

---

## 📋 Código de Conduta

- Seja respeitoso e construtivo
- Foque no problema, não na pessoa
- Aceite feedback de forma positiva
- Priorize o bem da comunidade

---

## 🚀 Como Contribuir

### 1. Reportar Bugs

**Antes de reportar:**
- Verifique se o bug já foi reportado nas [Issues](../../issues)
- Confirme que está usando a versão mais recente

**Ao reportar, inclua:**
- Descrição clara do problema
- Passos para reproduzir
- Comportamento esperado vs. atual
- Screenshots (se aplicável)
- Versão do Python e sistema operacional
- Logs de erro completos

**Template de Issue:**
```markdown
## Descrição do Bug
[Descrição clara e concisa]

## Passos para Reproduzir
1. Abra '...'
2. Clique em '...'
3. Veja o erro

## Comportamento Esperado
[O que deveria acontecer]

## Comportamento Atual
[O que está acontecendo]

## Ambiente
- OS: [Windows 10, Ubuntu 22.04, etc.]
- Python: [3.12.6]
- Browser: [Chrome 120, Firefox 115, etc.]

## Logs
```
[Cole os logs aqui]
```
```

---

### 2. Sugerir Melhorias

**Para novas funcionalidades:**
- Descreva claramente o problema que resolve
- Explique por que seria útil para outros usuários
- Sugira uma implementação (opcional)

**Template de Feature Request:**
```markdown
## Funcionalidade Sugerida
[Descrição da funcionalidade]

## Problema que Resolve
[Por que isso é necessário?]

## Solução Proposta
[Como deveria funcionar]

## Alternativas Consideradas
[Outras formas de resolver]

## Exemplos de Uso
[Como seria usado na prática]
```

---

### 3. Contribuir com Código

#### Setup do Ambiente de Desenvolvimento

```bash
# 1. Fork o repositório no GitHub

# 2. Clone seu fork
git clone https://github.com/SEU_USUARIO/InfoGEO.git
cd InfoGEO

# 3. Adicione o repositório original como upstream
git remote add upstream https://github.com/REPO_ORIGINAL/InfoGEO.git

# 4. Crie ambiente virtual
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# ou
.venv\Scripts\activate     # Windows

# 5. Instale dependências
pip install -r server/requirements.txt

# 6. Instale ferramentas de desenvolvimento (opcional)
pip install black flake8 pytest
```

#### Workflow de Desenvolvimento

```bash
# 1. Atualize seu fork
git checkout main
git pull upstream main

# 2. Crie uma branch para sua feature
git checkout -b feature/minha-funcionalidade
# ou
git checkout -b fix/correcao-bug

# 3. Faça suas alterações
# ... edite os arquivos ...

# 4. Teste suas alterações
python server/servidor.py  # Teste manual
# python -m pytest tests/    # Testes automatizados (se disponível)

# 5. Commit suas mudanças
git add .
git commit -m "feat: adiciona nova funcionalidade X"

# 6. Push para seu fork
git push origin feature/minha-funcionalidade

# 7. Abra um Pull Request no GitHub
```

#### Padrão de Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: adiciona suporte a formato GeoPackage
fix: corrige cálculo de área em polígonos complexos
docs: atualiza README com exemplos de uso
style: formata código com black
refactor: reorganiza funções de validação
test: adiciona testes para módulo de valoração
chore: atualiza dependências
```

**Tipos:**
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação (sem mudança de código)
- `refactor`: Refatoração de código
- `test`: Adição de testes
- `chore`: Manutenção geral

---

### 4. Padrões de Código

#### Python

```python
# Use Black para formatação
black server/servidor.py

# Siga PEP 8
flake8 server/servidor.py

# Docstrings em todas as funções públicas
def processar_geometria(geom):
    """
    Processa geometria para análise.
    
    Args:
        geom: Geometria Shapely
        
    Returns:
        GeoDataFrame processado
        
    Raises:
        ValueError: Se geometria for inválida
    """
    pass

# Type hints quando possível
def calcular_area(geom: Polygon) -> float:
    return geom.area
```

#### JavaScript

```javascript
// Use camelCase para variáveis e funções
function processarResultados(data) {
    // Comente código complexo
    const areas = data.map(item => item.area);
    
    // Use const/let, não var
    const total = areas.reduce((a, b) => a + b, 0);
    
    return total;
}

// Arrow functions quando apropriado
const filtrarPolygons = (polys) => polys.filter(p => p.area > 1000);
```

---

### 5. Testes

```python
# Teste suas mudanças antes de submeter
# Teste básico de importação
python -c "import servidor; print('OK')"

# Teste de sintaxe
python -m py_compile server/servidor.py

# Teste funcional manual
# 1. Inicie o servidor
# 2. Faça upload de arquivo de teste
# 3. Verifique resultados
```

---

### 6. Pull Request

**Checklist antes de submeter:**

- [ ] Código testado localmente
- [ ] Commits seguem Conventional Commits
- [ ] Código formatado (Black para Python)
- [ ] Sem erros de linting
- [ ] Documentação atualizada (se aplicável)
- [ ] CHANGELOG.md atualizado
- [ ] Screenshots adicionados (se mudança visual)

**Template de Pull Request:**

```markdown
## Descrição
[Descrição clara das mudanças]

## Tipo de Mudança
- [ ] Bug fix
- [ ] Nova funcionalidade
- [ ] Breaking change
- [ ] Documentação

## Como Testar
1. [Passo 1]
2. [Passo 2]
3. [Verificar que...]

## Screenshots (se aplicável)
[Cole aqui]

## Checklist
- [ ] Código testado
- [ ] Documentação atualizada
- [ ] CHANGELOG atualizado
- [ ] Commits seguem padrão
```

---

## 🎯 Áreas que Precisam de Contribuição

### Bugs Conhecidos
- [ ] Performance lenta em polígonos muito grandes
- [ ] Encoding de caracteres em alguns shapefiles

### Melhorias Desejadas
- [ ] Testes unitários automatizados
- [ ] Suporte a Docker
- [ ] Exportação de resultados em Excel
- [ ] API REST documentada
- [ ] Internacionalização (i18n)

### Documentação
- [ ] Vídeos tutoriais
- [ ] Mais exemplos de uso
- [ ] Tradução para inglês
- [ ] FAQ expandido

---

## 📞 Dúvidas?

- Abra uma [Issue](../../issues) com tag `question`
- Consulte a [documentação](README.md)
- Entre em contato com os mantenedores

---

## 🎉 Reconhecimento

Todos os contribuidores serão reconhecidos no README.md!

Obrigado por ajudar a melhorar o InfoGEO! 🚀
