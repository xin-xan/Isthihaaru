# Isthihaaru · އިސްތިހާރު

Turn a phone photo of a product into a professional social-media advertisement post in seconds.

1. **Snap or upload** a product photo. Any background is fine.
2. **AI re-renders** the product into a realistic advertising scene. The scene is automatic, or you can pick a style (Natural light, Studio, Luxury, Beach, Kitchen, Ice cold, Beauty, Ramadan / Eid) or describe your own.
3. **AI writes the copy** in English and Dhivehi (Thaana): category, name, subtitle, tagline and three features with icons. Everything is editable.
4. **Your business details** (logo, name, slogan, colours, phone/WhatsApp/Viber, socials, address, taglines) are added automatically. They are saved in the browser, with no login.
5. **Download or share** as a PNG in Square 1:1, Portrait 4:5, Story 9:16 or Landscape 16:9.

The layout follows [`samples/sample-ad.png`](samples/sample-ad.png).

## How it works

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

Get a key at <https://aistudio.google.com/apikey>.

## Deploy to Vercel

1. Import this repo in Vercel (framework: Next.js; the defaults are fine).
2. Add the environment variables under **Settings → Environment Variables**:

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | yes | – | Google AI Studio key |
| `GEMINI_IMAGE_MODEL` | no | `gemini-2.5-flash-image` | Try `gemini-3.1-flash-image-preview` or `gemini-3-pro-image-preview` for higher quality |
| `GEMINI_TEXT_MODEL` | no | `gemini-2.5-flash` | |
| `APP_ACCESS_CODE` | no | – | If set, users must enter this code before generating. This stops strangers from spending your API credits. |

API routes allow up to 60 s (`maxDuration`), which suits image generation on Vercel's free plan.

## Cost

Each **Create** makes one image call plus one text call. Each **Recreate** or **Rewrite** makes one more call. Check current Gemini pricing; for flash image models it is typically a few US cents per image.

## Notes and ideas for later

- Business details and a custom Thaana font (for example MV Faseyha or Faruma) are stored in `localStorage` on each device.
- Ideas: a phonetic Thaana keyboard for desktop users, multiple saved businesses, more layout templates, batch generation for a product catalogue.
