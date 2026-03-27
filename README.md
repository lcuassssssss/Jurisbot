# JurisBot

## Pasos para publicar en Vercel

1. Creá una cuenta gratis en https://vercel.com
2. Importá este repositorio desde el panel de Vercel
3. En el paso de configuración, agregá estas variables de entorno:
   - `SERP_KEY` → tu API key de SerpAPI
   - `ANTHROPIC_KEY` → tu API key de Anthropic
4. Click en Deploy
5. Vercel te da una URL del tipo jurisbot.vercel.app
6. Conectá tu dominio jurisbot.com.ar desde Settings → Domains

## Estructura
```
jurisbot/
├── index.html       ← landing + buscador
├── api/
│   ├── search.js    ← proxy a SerpAPI
│   └── claude.js    ← proxy a Anthropic
└── vercel.json      ← configuración
```
