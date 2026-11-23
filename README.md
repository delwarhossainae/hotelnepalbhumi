# Hotel Nepal Bhumi — One-Page Website

A fast, mobile-first one-page website for **Hotel Nepal Bhumi** (Amrit Marg, Thamel, Kathmandu).
All business facts, booking links and photos come from `Hotel Nepal Bhumi.txt`,
`Aerial & Adventure Activities.txt`, `Images/` and `Aerial & Adventure Activities/`.

**Sections:** sticky header · full-screen hero · about & amenities · rooms & gallery (with filters + lightbox) ·
10 booking platforms · WhatsApp booking form · 7 adventure/culture activities · contact & map · footer.

## Stack

- Static `index.html` + `assets/css/style.css` + `assets/js/main.js` (vanilla JS, no framework, no build step)
- Optional PHP 8.0+ endpoint `api/contact.php` (PHPMailer, authenticated SMTP) for an email form
- `.htaccess` for security headers, caching, compression and blocking private files (Apache / LiteSpeed)

Why static HTML instead of `index.php`: the page has no server-side data, so plain HTML is the fastest,
cheapest and most portable option — it runs on any PHP host, and you can test it without PHP. PHP is used only
where it's needed (the optional contact form).

```
index.html               the page
assets/css/style.css     styles (design tokens at the top: colours, fonts, spacing)
assets/js/main.js        menu, reveals, WhatsApp form, gallery, lightbox, contact form
assets/images/hotel/     responsive WebP versions of the hotel photos (480/800/1200/1600 widths)
assets/images/adventures/ responsive WebP versions of the activity photos
assets/images/og-image.jpg social sharing image (1200x630)
assets/icons/favicon.svg
api/contact.php          optional SMTP contact endpoint (CSRF, honeypot, timing check, rate limit)
includes/config.php      reads .env (blocked from the web)
.env.example             contact/SMTP settings template
robots.txt, sitemap.xml  SEO files (set your domain first)
tools/build-images.py    regenerates assets/images from the original photos
tests/qa.mjs             Playwright QA suite (89 checks)
tests/lighthouse/        last Lighthouse reports (HTML + JSON)
```

The original photos and text files are untouched. They aren't needed on the server; `.htaccess` blocks them
if you upload them anyway.

## Local development

Requirements: Python 3 (for a static server and image builds), Node 18+ (only for tests).

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/. To test the PHP contact endpoint locally, install PHP 8.0+ and run
`php -S 127.0.0.1:8765` instead.

## Deploying to PHP hosting (cPanel, Hostinger, etc.)

Never upload the project folder itself. Build a clean upload folder with your real domain:

```powershell
python tools/build-dist.py --domain https://www.your-domain.com
```

This creates `dist/` with only the live files: `index.html`, `assets/`, `api/`, `includes/`, `storage/.htaccess`,
`.htaccess`, `robots.txt`, `sitemap.xml`, `composer.json` and `.env.example`. It also fills in the domain everywhere
it's needed (canonical URL, `og:url`, `og:image`, structured data, `robots.txt`, `sitemap.xml`). Original photos, TXT
files, tests, tools and docs are left out. The build stops if any `YOUR-DOMAIN` placeholder remains.

1. Upload the **contents** of `dist/` to `public_html/` (or your web root), including the hidden `.htaccess` files.
2. Turn on SSL in your host's panel, then uncomment the HTTPS redirect and the HSTS line in `.htaccess` on the server.
3. Optional email form — see below. Without it the site works fully: guests use WhatsApp, phone and booking sites.
4. Work through the deployment checklist in `QA-REPORT.md`.

## Optional contact form (email)

The source files contain no hotel email address, so the form ships **disabled and hidden**.
The page asks `api/contact.php` whether it is configured and shows the form only then.

1. On the server, run `composer install --no-dev` (or upload a `vendor/` folder built locally).
2. Copy `.env.example` to `.env` and fill in `CONTACT_TO_EMAIL`, the SMTP settings, and set `CONTACT_FORM_ENABLED=true`.
3. Make sure `storage/` is writable by PHP (rate-limit data). `.env`, `includes/`, `storage/` and `vendor/` are blocked from the web.

Security: CSRF token (session, SameSite=Strict cookie), honeypot field, minimum fill time, 5 messages/hour/IP
rate limit, input validation and header-injection stripping, plain-text email, and honest error messages
(the page never shows "sent" unless SMTP actually accepted the message).

## Editing content

- **Booking links:** search `index.html` for `class="platform"` (Book section) and the footer "Book online" list.
  Each platform has its own property-specific URL from the source file.
- **WhatsApp number:** `WA_NUMBER` at the top of `assets/js/main.js`, plus the `wa.me/9779744465391` and
  `tel:+9779744465391` links in `index.html` (search and replace).
- **Ratings** (Booking.com 9.3 / 120 reviews, Google 4.4 / 48 reviews): hero and booking cards. These are
  snapshots from the source file — update them periodically.
- **Rates:** "from around NPR 1,036" appears in the About section and JSON-LD `priceRange`.
- **Room types:** the Stay section list and the `<select id="wa-room">` options.
- **Activities:** each `.adv-card` in the Adventures section; the `data-activity` value becomes the WhatsApp message.

## Images

1. Put new originals in `Images/` or `Aerial & Adventure Activities/`.
2. Add them to the `MAP` in `tools/build-images.py` with a short, descriptive name.
3. Run `python tools/build-images.py` (needs `pip install pillow`). It creates WebP files at 480/800/1200/1600 px
   (never upscaled) and prints sizes for `width`/`height` attributes.
4. Add `<img>` markup with `srcset`, `sizes`, `width`, `height`, `loading="lazy"` and meaningful `alt` text.

The best supplied hotel photo is 1535 px wide; a higher-resolution exterior or lobby photo would sharpen the hero
on large screens.

## Testing

```powershell
npm install
npx playwright install chromium
python -m http.server 8765 --bind 127.0.0.1
```

Then, in a second terminal:

| Command | What it checks |
|---|---|
| `npm test` | 98 functional checks: 10 widths, menu, anchors, WhatsApp form and message, guest steppers, activity links, gallery, lightbox, header, reduced motion |
| `npm run audit` | responsive audit at 16 viewports (overflow, overlaps, clipped text, tap targets, image crops, menu, covered form fields); screenshots in `tests/screens/audit/` |
| `npm run check:assets` | every image/CSS/JS path in the page exists; no unused asset files |
| `npm run test:php` | `api/contact.php` under PHP's built-in server: CSRF, honeypot, timing, validation, header injection, rate limit, honest failure (PHP 8.0+; stub mailer, sends no email) |
| `npm run test:contact` | the page's contact form end-to-end against the PHP endpoint (stub mailer) |
| `npx lighthouse@12.8.2 http://127.0.0.1:8765/ --view` | performance, accessibility, best practices, SEO |

Set `BASE_URL` to test another server, for example `$env:BASE_URL="https://staging.your-domain.com/"; npm test`.
The PHP tests use `C:\xampp\php\php.exe` by default; pass another PHP path as the first argument.

## Credits

Designed and developed by **MH** — https://www.hossain.me/

The footer line "Developed by MH" (linked to https://www.hossain.me/) is required attribution and must stay
visible on every page. `assets/js/main.js` restores it automatically if it is removed, hidden, re-styled or
changed in the page. Do not remove or alter it.
