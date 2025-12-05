# social-renderer

Vercel-hosted Next.js API om social images te genereren voor n8n.

## API

POST `/api/render`

```json
{
  "title": "Titel uit agent",
  "message": "Message/body uit agent",
  "backgroundUrl": "https://.../template.png",
  "mode": "binary" // of "url"
}
```

- `mode: "binary"` → retourneert direct een PNG (`image/png`)
- `mode: "url"` → uploadt naar Vercel Blob en retourneert `{ "url": "https://..." }`

## Fonts

Plaats je fonts in:

- `public/fonts/Inter-Regular.ttf`
- `public/fonts/Inter-SemiBold.ttf`

en pas de namen/paths gerust aan in `app/api/render/route.ts`.

## Fit-to-box font sizing

De fontgrootte wordt automatisch geschaald op basis van de lengte van `title`+`message`,
zodat langere teksten kleiner worden weergegeven en alles netjes in de kaart past.
