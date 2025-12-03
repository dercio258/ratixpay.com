#!/bin/bash

# Script para adicionar cache busting ao sidebar em todas as páginas HTML
# Adiciona ?v=timestamp ao carregamento do sidebar-component.js

echo "🔄 Adicionando cache busting ao sidebar..."

cd public || exit 1

# Versão baseada em timestamp
VERSION=$(date +%s)

# Atualizar todas as referências ao sidebar-component.js
find . -name "*.html" -type f | while read -r file; do
    # Adicionar cache busting se ainda não tiver
    if grep -q 'sidebar-component.js' "$file" && ! grep -q 'sidebar-component.js?v=' "$file"; then
        sed -i "s|src=[\"']\([^\"']*\)js/sidebar-component.js[\"']|src=\"\1js/sidebar-component.js?v=${VERSION}\"|g" "$file"
        sed -i "s|src=[\"']\([^\"']*\)/js/sidebar-component.js[\"']|src=\"\1/js/sidebar-component.js?v=${VERSION}\"|g" "$file"
        echo "✅ Atualizado: $file"
    fi
done

echo "✅ Cache busting adicionado ao sidebar (versão: ${VERSION})"
echo "💡 Execute: pm2 restart ratixpay para aplicar"

