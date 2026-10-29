# Isthihaaru · އިސްތިހާރު

Turn a phone photo of a product into a professional social-media advertisement post in seconds.

1. **Snap or upload** a product photo. Any background is fine.
2. **The product goes into a realistic advertising scene**, using either of two engines (see below). The scene is automatic, or you can pick a style (Natural light, Studio, Luxury, Beach, Kitchen, Ice cold, Beauty, Ramadan / Eid) or describe your own.
3. **AI writes the copy** in English and Dhivehi (Thaana): category, name, subtitle, tagline and three features with icons. Everything is editable.
4. **Your business details** (logo, name, slogan, colours, phone/WhatsApp/Viber, socials, address, taglines) are added automatically. They are saved in the browser, with no login.
5. **Download or share** as a PNG in Square 1:1, Portrait 4:5, Story 9:16 or Landscape 16:9.

The layout follows [`samples/sample-ad.png`](samples/sample-ad.png).

## Works with no API keys

By default the app needs **no API keys and no server**:

- **Background removal** runs on the phone, in a background worker so the page never freezes. A quick pass (U²-Net, about 2 s) shows a cut-out right away. A **best-quality pass** (ISNet, downloaded once, 46 MB) then replaces it with cleaner edges. Both passes look again at a tight crop around the product, drop leftover background blobs, fill small holes, and snap edges to the photo with a guided filter. Users can switch the best pass off.
- **Scenes** come from 12 built-in canvas-drawn sets: Natural light, Studio, Brand colours, Pastel, Luxury, Beach, Ice cold, Wooden table, Tropical green, Sunset, Ramadan / Eid and Clean white. Users can also upload their own background photo. The pedestal is always drawn under the product.
- **Text** comes from ready-made English and Dhivehi lines for 11 product categories, with "Try other wording" to cycle through them. Everything stays editable.

`npm run build:static` writes this version to `dist/`: one HTML page plus the model, the WebAssembly runtime and an example image. It can be hosted on any static host (GitHub Pages, Netlify, Cloudflare Pages).

The AI engines below are optional extras. They appear automatically when the Next.js server has the keys.

## Scene engines

| | **Free** | **Premium** |
| --- | --- | --- |
| How | The product is cut out **in the browser** (U²-Net model, `public/models/u2netp.onnx`). Cloudflare Workers AI (FLUX.1 schnell) makes an empty background, and the canvas stands the real product on it with contact and drop shadows. | A Gemini image model re-renders the whole photo into the scene. |
| Product label | Pixel-perfect, exactly as photographed | Usually faithful; can drift slightly |
| Lighting realism | Good (synthetic shadows) | Best (real reflections and relighting) |
| Cost | Free: 10,000 Cloudflare neurons/day, roughly 100+ backgrounds | A few cents per image; needs Gemini billing |
| Needs | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | `GEMINI_API_KEY` with billing |

Users switch engines in step 2. If Premium is chosen and the key has no billing, the app falls back to Free automatically. In Free mode, **Product size** and **Product height** sliders appear under Layout. One background works for every post size.

## How it works

- `lib/bgremove.ts` and `lib/segment/`: the two-pass cut-out in a Web Worker (onnxruntime-web). `npm install` copies the WebAssembly runtime to `public/ort`; `npm run dev` and `npm run build` bundle the worker to `public/bg-worker.js`. The models and their licences are listed in `public/models/README.md`.
- `app/api/background`: asks Cloudflare Workers AI for an empty set to place the product on.
- `app/api/scene`: sends the photo to a **Gemini image model** with a prompt that keeps the product identical, removes the background, builds the chosen scene and leaves calm space on the text side. No text is baked into the image.
- `app/api/copy`: asks a **Gemini text model** for structured JSON copy in English and Dhivehi.
- `lib/poster/render.ts`: draws the final poster on a `<canvas>`. Text is laid out as sharp vector text with real fonts (Montserrat, Kaushan Script, Noto Sans Thaana) and correct right-to-left Thaana shaping. Light or dark text is picked automatically from the scene's brightness. Dhivehi posters move the text block to the right by default.
- The API key stays on the server. Photos are resized on the phone (max 1536 px) before upload.

## Run locally

```bash
npm install
cp .env.example .env.local   # then add your GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

Get a key at <https://aistudio.google.com/apikey>. Gemini image models have no free-tier quota, so Premium scenes need **billing enabled** on the key's project. Free mode needs a free Cloudflare account instead.

## Deploy to Vercel

1. Import this repo in Vercel (framework: Next.js; the defaults are fine).
2. Add the environment variables under **Settings → Environment Variables**:

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | yes | – | Google AI Studio key. Ad copy works on the free tier. |
| `CLOUDFLARE_ACCOUNT_ID` | for Free mode | – | Cloudflare dashboard, Workers AI page |
| `CLOUDFLARE_API_TOKEN` | for Free mode | – | API token from the "Workers AI" template |
| `CLOUDFLARE_IMAGE_MODEL` | no | `@cf/black-forest-labs/flux-1-schnell` | |
| `GEMINI_IMAGE_MODEL` | no | `gemini-3.1-flash-image` | `gemini-3-pro-image` for higher quality, `gemini-3.1-flash-lite-image` for lower cost |
| `GEMINI_TEXT_MODEL` | no | `gemini-3.5-flash` | |
| `APP_ACCESS_CODE` | no | – | If set, users must enter this code before generating. This stops strangers from spending your API credits. |

API routes allow up to 60 s (`maxDuration`), which suits image generation on Vercel's free plan.

## Cost

In Free mode the only paid-type call is the Cloudflare background, which stays within the free daily allowance for normal use; the cut-out runs on the user's device. In Premium mode each **Create** makes one image call plus one text call. Each **Recreate** or **Rewrite** makes one more call. Check current Gemini pricing; for flash image models it is typically a few US cents per image.

## Notes and ideas for later

- Business details and a custom Thaana font (for example MV Faseyha or Faruma) are stored in `localStorage` on each device.
- Ideas: a phonetic Thaana keyboard for desktop users, multiple saved businesses, more layout templates, batch generation for a product catalogue.
