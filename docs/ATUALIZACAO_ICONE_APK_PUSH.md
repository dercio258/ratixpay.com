# Atualização de Ícones para APK e Push Notifications

## ✅ Mudanças Implementadas

### Ícone Específico para APK e Push Notifications
- **Arquivo fonte:** `/assets/images/icons/icon_apk_pushNotificatio.png`
- **Uso exclusivo:** APK (manifest.json) e Push Notifications
- **Separação:** Mantém `icon_principal.png` para loaders e favicons do site

---

## 📦 Ícones Gerados

### Ícones para APK (manifest.json)
- `apk-icon-48x48.png` - Ícone pequeno
- `apk-icon-72x72.png` - Ícone médio
- `apk-icon-96x96.png` - Ícone grande
- `apk-icon-144x144.png` - Ícone extra grande
- `apk-icon-192x192.png` - Ícone principal APK
- `apk-icon-512x512.png` - Ícone máximo APK

### Ícones para Push Notifications
- `push-icon-48x48.png` - Badge pequeno
- `push-icon-96x96.png` - Badge grande
- `push-icon-120x120.png` - Ícone médio
- `push-icon-192x192.png` - Ícone principal push

---

## 📁 Arquivos Atualizados

### Manifest (APK)
- ✅ `public/manifest.json`
  - Todos os ícones principais atualizados para `apk-icon-*`
  - Shortcuts atualizados para usar `apk-icon-96x96.png`

### Push Notifications
- ✅ `public/js/push-notifications.js`
  - Ícone: `push-icon-192x192.png`
  - Badge: `push-icon-48x48.png`

- ✅ `public/js/push-notifications-advanced.js`
  - Ícone: `push-icon-192x192.png`
  - Badge: `push-icon-48x48.png`

### Service Workers
- ✅ `public/sw.js`
  - Ícone: `push-icon-192x192.png`
  - Badge: `push-icon-48x48.png`

- ✅ `public/sw-pwa.js`
  - Ícone: `push-icon-192x192.png`
  - Badge: `push-icon-96x96.png`

---

## 🎯 Separação de Ícones

### APK (Aplicativo Mobile)
- **Fonte:** `icon_apk_pushNotificatio.png`
- **Uso:** Manifest.json, ícone do aplicativo instalado
- **Localização:** `/assets/images/icons/apk-icon-*.png`

### Push Notifications
- **Fonte:** `icon_apk_pushNotificatio.png`
- **Uso:** Notificações push do navegador
- **Localização:** `/assets/images/icons/push-icon-*.png`

### Loader e Favicons (Site)
- **Fonte:** `icon_principal.png`
- **Uso:** Carregamento de páginas, favicons do navegador
- **Localização:** `/assets/images/icons/loader-icon-*.png` e `/assets/images/icons/favicon-*.png`

---

## 🔄 Como Regenerar os Ícones

Se precisar regenerar os ícones a partir do `icon_apk_pushNotificatio.png`:

```bash
node scripts/generate-apk-push-icons.js
```

---

## 📋 Estrutura de Ícones

```
public/assets/images/icons/
├── icon_apk_pushNotificatio.png          # Fonte para APK e Push
├── icon_principal.png                    # Fonte para loader e favicons
│
├── apk-icon-*.png                        # Ícones para APK
│   ├── apk-icon-48x48.png
│   ├── apk-icon-72x72.png
│   ├── apk-icon-96x96.png
│   ├── apk-icon-144x144.png
│   ├── apk-icon-192x192.png
│   └── apk-icon-512x512.png
│
├── push-icon-*.png                       # Ícones para Push Notifications
│   ├── push-icon-48x48.png
│   ├── push-icon-96x96.png
│   ├── push-icon-120x120.png
│   └── push-icon-192x192.png
│
├── loader-icon-*.png                     # Ícones para loader (do icon_principal.png)
│   ├── loader-icon-80.png
│   └── loader-icon-120.png
│
└── favicon-*.png                         # Favicons (do icon_principal.png)
    ├── favicon-16x16.png
    └── favicon-32x32.png
```

---

## ✅ Status

- ✅ Ícones gerados a partir de `icon_apk_pushNotificatio.png`
- ✅ Manifest.json atualizado para usar ícones APK
- ✅ Push notifications atualizados para usar ícones push
- ✅ Service workers atualizados
- ✅ Separação clara entre ícones APK/Push e ícones do site

---

**Data:** $(date)
**Status:** ✅ Concluído

