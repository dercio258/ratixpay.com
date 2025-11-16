#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re

# Ler o arquivo
with open('public/criar-produto.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remover linhas em branco excessivas (mais de 2 linhas consecutivas)
content = re.sub(r'\n{3,}', '\n\n', content)

# Substituir valores hardcoded por variáveis CSS
replacements = [
    # Cores
    (r'#ff6b35', 'var(--primary-color)'),
    (r'#e55a2b', 'var(--primary-hover)'),
    (r'#6c757d', 'var(--secondary-color)'),
    (r'#545b62', 'var(--secondary-hover)'),
    (r'#2c3e50', 'var(--text-dark)'),
    (r'#e9ecef', 'var(--border-color)'),
    (r'#f8f9fa', 'var(--bg-light)'),
    (r'#28a745', 'var(--success-color)'),
    (r'#dc3545', 'var(--error-color)'),
    # Border radius
    (r'border-radius:\s*10px', 'border-radius: var(--border-radius-lg)'),
    (r'border-radius:\s*8px', 'border-radius: var(--border-radius)'),
    (r'border-radius:\s*6px', 'border-radius: var(--border-radius)'),
    # Transitions
    (r'transition:\s*all\s+0\.3s\s+ease', 'transition: var(--transition)'),
    (r'transition:\s*border-color\s+0\.3s\s+ease', 'transition: var(--transition)'),
    (r'transition:\s*background-color\s+0\.3s\s+ease', 'transition: var(--transition)'),
    # Shadows
    (r'box-shadow:\s*0\s+4px\s+6px\s+rgba\(0,\s*0,\s*0,\s*0\.1\)', 'box-shadow: var(--shadow)'),
]

for pattern, replacement in replacements:
    content = re.sub(pattern, replacement, content)

# Salvar o arquivo
with open('public/criar-produto.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Refatoração aplicada com sucesso!")


