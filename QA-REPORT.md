# Production Readiness Report — Hotel Nepal Bhumi

Audit date: 2026-11-23. Tested locally with Playwright 1.65.1 (Chromium), Lighthouse 12.8.2 (Chrome), PHP 8.0.30 and
Apache 2.4.58 (XAMPP) serving the production build in `dist/`.

## Verdict: not ready to publish yet — 2 launch blockers need the owner

The code, content and server configuration pass every automated check below. Two items can't be resolved by code
and must be settled before going live:

| # | Blocker | Why it blocks launch | What to do |
|---|---|---|---|
| 1 | **Production domain unknown** | Canonical URL, `og:url`, `og:image`, structured data, `robots.txt` and `sitemap.xml` need the real domain; the source file uses the placeholder `YOUR-DOMAIN` | Run `python tools/build-dist.py --domain https://www.your-domain.com`. The build refuses to finish if any placeholder remains |
| 2 | **Phone / WhatsApp number not confirmed** | `Hotel Nepal Bhumi.txt` lists "Phone: +9744465391" (no country code) and elsewhere "+977 974-4465391" / WhatsApp "+9779744465391". Every booking enquiry depends on this number | The site uses **+977 974-4465391** everywhere. The owner must confirm it, ideally by sending a test WhatsApp from the live site |

Strongly recommended before launch (not code defects):
- Open the **Tripadvisor** and **Traveloka** links once in a normal browser. Both sites block automated checks, so they couldn't be confirmed here.
- Test one real **WhatsApp enquiry** on a phone after deploying.

## Deployment checklist

**Before uploading**
- [ ] Owner confirms the phone/WhatsApp number (+977 974-4465391).
- [ ] `python tools/build-dist.py --domain https://www.your-domain.com` runs without errors.
- [ ] Optional: replace the 1535 px hero photo with a higher-resolution or exterior photo (re-run `python tools/build-images.py`).

**Upload and server**
- [ ] Upload the **contents** of `dist/` to the web root, including the hidden `.htaccess` files.
- [ ] Do **not** upload `Images/`, `Aerial & Adventure Activities/`, the TXT files, `tests/`, `tools/`, `node_modules/`, `.claude/` or the `.md` files (`dist/` already excludes them).
- [ ] Turn on SSL; then uncomment the HTTPS redirect and the HSTS header in `.htaccess`.
- [ ] Hosting runs Apache or LiteSpeed with `.htaccess` enabled, and PHP 8.0+ if you'll use the contact form.

**After going live — check on the real URL**
- [ ] `https://your-domain/` loads over HTTPS; `http://` redirects to it.
- [ ] `https://your-domain/.env.example`, `/.htaccess`, `/includes/config.php` and `/composer.json` return **403**.
- [ ] Response headers include `Content-Security-Policy`, `X-Content-Type-Options` and `Referrer-Policy`, and CSS/JS are gzip-compressed (DevTools → Network).
- [ ] Send a test enquiry from the WhatsApp form **on a phone** and confirm it arrives with every field.
- [ ] Tap each of the 10 booking buttons once; each opens the Hotel Nepal Bhumi listing.
- [ ] Map shows the hotel pin; "Get Directions" opens Google Maps.
- [ ] Run PageSpeed Insights (https://pagespeed.web.dev/) on the live URL.
- [ ] Validate structured data with Google's Rich Results Test (https://search.google.com/test/rich-results).
- [ ] Submit `https://your-domain/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- [ ] Optional email form: `composer install --no-dev`, create `.env` from `.env.example`, set `CONTACT_FORM_ENABLED=true`, make `storage/` writable, then send one real test message.

## What was verified

### Content vs. source TXT files — match
Checked by script against `Hotel Nepal Bhumi.txt` and `Aerial & Adventure Activities.txt`:
- **All 10 booking URLs** appear exactly as written, each on its own card (Booking.com, Google Hotels, Expedia and Tripadvisor also appear in the footer and structured data).
- Google Maps link, address (Amrit Marg, Thamel, Kathmandu 44600, Bagmati Province), near Kathmandu Durbar Square, ~5 km / 3.1 mi from the airport, open 24 hours, check-in 2:00 PM, check-out 12:00 PM, from around NPR 1,036, 3-star, Booking.com 9.3 (120 reviews), Google 4.4 (48 reviews).
- All 8 amenities and all 7 room types (duplicates in the file merged).
- **All 7 activities**, each with every place and detail named in the file: Pokhara, Sarangkot, Phewa Lake, Annapurna, Everest, 160 m, Bhote Koshi, Trishuli, rafting, canyon swing, Everest Base Camp, Nagarkot, Dhulikhel, Boudhanath, Swayambhunath, Pashupatinath, Patan, Bhaktapur, rhinos, tigers, birdlife, jeep/walking, Chitwan, Bardia, momos, sekuwa, bara, yoga, Ayurveda, homestay.
- No external URLs on the page other than those in the TXT files, plus WhatsApp, Google Fonts, the map embed and the developer credit.

### External links — 8 of 10 booking listings confirmed
| Link | Result |
|---|---|
| Google Hotels, Hostelworld, Expedia, Hotels.com, Trip.com, MakeMyTrip, Goibibo | Page loads with title "Hotel Nepal Bhumi" |
| Booking.com | Redirects to the same listing (`/hotel/np/nepal-bhumi.en-gb.html`) behind a bot check; page body not readable by automation |
| **Tripadvisor, Traveloka** | **HTTP 403 to automated browsers — not verified** |
| Google Maps short link | Resolves to "Hotel Nepal Bhumi" at 27.7120548, 85.3120561 (now in the structured data) |
| Map embed | Pin on Hotel Nepal Bhumi, Amrit Marg (4.4 ★, 48 reviews) |
| `wa.me/9779744465391` | Resolves to WhatsApp for phone 9779744465391; used for every WhatsApp link and message |
| hossain.me (credit) | Loads |

### Images — all paths resolve
- `tools/check-assets.py`: 64 asset references, **0 missing, 0 unused**.
- 20 of 38 supplied photos used. The rest are duplicates or alternate crops of photos already used. Two were deliberately excluded: an elephant-ride safari photo (the text says jeep or walking safaris) and pani puri (not a dish named in the text).
- All `<img>` have alt text, width and height; below-the-fold images lazy-load; hero preloaded with `fetchpriority="high"`.

### SEO — passes
Title, meta description, one H1, logical H2–H4, Open Graph + Twitter card, 1200×630 share image, Hotel structured data (address, geo, phone, check-in/out, amenities, star rating, price range; no fake review markup), `robots.txt`, `sitemap.xml`. The domain-dependent tags are filled in by the build. Lighthouse SEO: 100.

### PHP contact handler — passes logic tests; real email not tested
- `php -l`: no syntax errors (PHP 8.0.30).
- `tests/php-contact-test.py`: **16/16 passed**:
  - disabled state (no cookie, honest 503)
  - CSRF token, and rejection of a request without a session
  - honeypot, too-fast and stale-form rejection
  - validation messages
  - header-injection stripping
  - Reply-To set to the guest
  - `.env` inline comments ignored
  - rate limit (429 after the limit)
  - honest 502 when SMTP fails
- `tests/contact-form-e2e.mjs`: **5/5 passed**. Form hidden when unconfigured; success message only after the server accepts; honest error when mail fails.
- **Not tested: real SMTP delivery.** No mailbox exists (no email address in the source); a stub mailer was used.

### Server configuration (Apache serving `dist/`) — passes
- Security headers present: CSP, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy. **No CSP violations** in the browser; web fonts and the map load.
- gzip on HTML/CSS/JS; 30-day caching on images/CSS/JS; `no-cache` on HTML.
- 403 for `.env.example`, `.htaccess`, `composer.json`, `includes/`, `storage/`, `*.md`, TXT sources; 404 for `vendor/` and `Images/`; no directory listings.
- `api/contact.php` returns JSON, `{"enabled":false}` until configured, and 405 for PUT.

### JavaScript, responsive layout and accessibility — passes
- `tests/qa.mjs`: **98/98 passed** against Apache serving `dist/`. Covers menu, anchors, WhatsApp validation, encoding and the "not confirmed until we reply" wording, guest steppers, auto check-out, activity enquiry links, gallery filters, lightbox keyboard/focus trap, header, floating buttons, and reduced motion (no running animations).
- `tests/responsive-audit.mjs`: **0 issues at 16 viewports**, 320×640 to 1920×1080, including landscape phones.
- No console errors at any width.

### Lighthouse (Apache serving `dist/`, gzip + caching on)

| | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Desktop (2 runs) | 97–99 | 100 | 100 | 100 | 0.8–1.0 s | 0–0.003 | 0–130 ms |
| Mobile (3 runs) | 78–85 | 100 | 100 | 100 | 2.1–2.6 s | 0–0.001 | 440–850 ms |

Mobile performance is below the 90 target, and this run-to-run range is typical on this machine. The main cost is
re-laying out the page when the web fonts arrive: about 600 ms of throttled style/layout work. Blocking the fonts
removed it in a controlled test. Self-hosting the two font families with a preload would reduce this; that requires
downloading the font files, so it wasn't done without your approval. LCP met the 2.5 s target in 2 of 3 runs. Measure on
the live site with PageSpeed Insights.

## Fixes made in this audit
- `.htaccess` itself was downloadable on a server without a global rule → now blocked (`.ht*` / `.git*` → 403).
- PHP warnings could be mixed into the contact endpoint's JSON → error display off in the endpoint (errors still logged).
- The `.env` reader treated `KEY=value  # comment` as part of the value → comments now ignored (quoted values kept intact).
- The contact endpoint started a session even when disabled → no cookie until the form is configured.
- The rate limit counted only successful sends → now counts every accepted attempt.
- `never` return type required PHP 8.1 → changed to `void`; the endpoint now runs on PHP 8.0+ (tested on 8.0.30).
- Hero booking chips' accessible names didn't match their visible text → fixed (Lighthouse audit now passes).
- 3 large adventure image sizes were generated but never used → added to `srcset` for large screens; an unused photo set removed.
- Verified map coordinates added to the structured data.
- One unused font weight removed (one fewer font download).
- New `tools/build-dist.py` creates a clean upload folder with the domain filled in and fails on leftover placeholders.

## Development artifacts removed
Removed: screenshots (`tests/screens/`), Lighthouse reports, test logs, `node_modules/`, the design-review and
performance-probe scripts, and the temporary `dist/` built with a test domain (so it can't be uploaded by mistake).
The project dropped from 118 MB to 14 MB; nearly all of what remains is the original photos. `.gitignore` covers
regenerated outputs. Kept on purpose:
- test scripts (`tests/`) and build tools (`tools/`)
- `package.json`, README and this report
- `.claude/launch.json`, which configures this app's local preview

None of these go into `dist/`.

## Could not be verified here
- Tripadvisor and Traveloka listings (403 to automation) and the Booking.com page body (bot check).
- Real email delivery through SMTP (no mailbox; stub used).
- Safari, Firefox and real iOS/Android devices (Chromium only).
- Behaviour on the actual hosting provider (verified on Apache 2.4.58; LiteSpeed reads the same `.htaccess` directives, but this wasn't tested).
- Field Core Web Vitals (needs real traffic).

## Content notes for the owner
- No email address or social media profiles in the source → none shown; the contact form stays hidden until configured.
- No exterior photo or logo supplied → hero uses the lobby; text wordmark used.
- Ratings (9.3 / 120 and 4.4 / 48) are snapshots from the source file; update them periodically.
- Activity prices, durations and operators weren't supplied → none shown; enquiries go to WhatsApp.
- Free/paid status of the airport shuttle and pet policy isn't stated → not described as free.
- The gallery shows a shared bunk room and a kitchen, which aren't in the room/amenity lists. Confirm guests can book or use them, or remove those two tiles.
- No privacy policy page exists → none linked. Add one if you enable the contact form or analytics.

## How to re-run
See README → Testing: `npm test`, `npm run audit`, `npm run check:assets`, `npm run test:php`, `npm run test:contact`, Lighthouse.
