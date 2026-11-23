// Responsive audit: node tests/responsive-audit.mjs  (site on http://127.0.0.1:8765)
// Checks every width/orientation for overflow, overlapping text, clipped text, distorted images,
// small or covered tap targets, menu behaviour, and saves per-section screenshots to tests/screens/audit/.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765/';
const SHOTS = process.argv.includes('--shots');
const views = [
  [320, 640], [360, 740], [375, 667], [390, 844], [414, 896], [430, 932],
  [568, 320], [667, 375], [844, 390], // phone landscape
  [768, 1024], [820, 1180], [1024, 768], [1024, 1366], [1280, 800], [1440, 900], [1920, 1080],
];
mkdirSync('tests/screens/audit', { recursive: true });
const browser = await chromium.launch();
const issues = [];
const note = (v, msg) => issues.push(`${v}  ${msg}`);

for (const [w, h] of views) {
  const v = `${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 1024, isMobile: w < 768 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 30)); }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    const out = [];
    const cw = document.documentElement.clientWidth;
    const vis = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && el.getClientRects().length; };
    const label = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 28)}"`;
    // 1. page overflow
    if (document.documentElement.scrollWidth > cw) out.push(`page overflows by ${document.documentElement.scrollWidth - cw}px`);
    // 2. elements sticking out of the viewport (ignoring intentional carousels/decor)
    for (const el of document.querySelectorAll('main *, footer *, header *')) {
      if (el.closest('.adv-grid,.float-accent,.hp,.sr-only,svg,.lightbox,.hero-img,.skip-link')) continue;
      const b = el.getBoundingClientRect();
      if (b.width && (b.right > cw + 1 || b.left < -1) && vis(el)) { out.push(`outside viewport: ${label(el)} (${Math.round(b.left)}..${Math.round(b.right)})`); break; }
    }
    // 3. clipped text (content wider than its box)
    for (const el of document.querySelectorAll('h1,h2,h3,h4,p,a,button,label,span,strong,small,dd,dt,li')) {
      if (!vis(el) || el.closest('.sr-only,.hp,.adv-grid .adv-card:not(:first-child)')) continue;
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible') out.push(`clipped text: ${label(el)}`);
    }
    // 4. overlapping text blocks (leaf text elements whose boxes intersect)
    const leaves = [...document.querySelectorAll('h1,h2,h3,h4,p,label,dt,dd,.btn,.p-name,.p-meta,.p-go,.p-rating,.g-cap,.chip,.hb-chip,.adv-cta,.adv-loc,.contact-list a,.contact-list span,.contact-list strong,.eyebrow')]
      .filter((el) => vis(el) && !el.closest('.lightbox,.sr-only,.hp,.book-bar,.wa-float,.site-header'))
      .filter((el) => ![...el.querySelectorAll('h1,h2,h3,h4,p,label,.btn')].length);
    const boxes = leaves.map((el) => ({ el, b: el.getBoundingClientRect() }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], c = boxes[j];
      if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
      const ox = Math.min(a.b.right, c.b.right) - Math.max(a.b.left, c.b.left);
      const oy = Math.min(a.b.bottom, c.b.bottom) - Math.max(a.b.top, c.b.top);
      if (ox > 4 && oy > 4) out.push(`overlap: ${label(a.el)} × ${label(c.el)}`);
    }
    // 5. distorted images (rendered aspect differs from natural aspect without object-fit)
    for (const img of document.images) {
      if (!img.naturalWidth || !vis(img)) continue;
      const s = getComputedStyle(img); const b = img.getBoundingClientRect();
      if (s.objectFit === 'cover' || s.objectFit === 'contain') continue;
      const nat = img.naturalWidth / img.naturalHeight, ren = b.width / b.height;
      if (Math.abs(nat - ren) / nat > 0.03) out.push(`distorted image: ${img.currentSrc.split('/').pop()} (${nat.toFixed(2)} vs ${ren.toFixed(2)})`);
    }
    // 6. tap targets < 44px (WCAG 2.5.5 AAA guidance; inline links in sentences excluded)
    for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="button"]')) {
      if (!vis(el) || el.closest('.hp,.skip-link,.lightbox[hidden],p,.adv-grid .adv-card:not(:first-child)')) continue;
      if (el.closest('.book-bar') && !el.closest('.book-bar.is-visible')) continue;
      const b = el.getBoundingClientRect();
      if (b.height < 44 || b.width < 44) out.push(`small target ${Math.round(b.width)}x${Math.round(b.height)}: ${label(el)}`);
    }
    // 7. form controls with font-size < 16px (iOS zooms the page on focus)
    for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
      if (el.closest('.hp')) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 16) out.push(`input font ${fs}px (iOS zoom): ${label(el)}`);
    }
    // 8. images whose focal crop is tiny (rendered box much smaller than 120px tall)
    for (const img of document.querySelectorAll('main img')) {
      const b = img.getBoundingClientRect();
      if (vis(img) && b.height && b.height < 110) out.push(`image very short ${Math.round(b.height)}px: ${img.currentSrc.split('/').pop()}`);
    }
    return [...new Set(out)];
  });
  r.forEach((m) => note(v, m));
  if (errs.length) note(v, 'JS errors: ' + errs.join(' | '));

  // Fixed elements must not cover the WhatsApp form fields or submit button when they are in view
  const cover = await page.evaluate(async () => {
    const out = [];
    const targets = [...document.querySelectorAll('#wa-form input, #wa-form select, #wa-form textarea, #wa-form button')];
    for (const t of targets) {
      t.scrollIntoView({ block: 'center', behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 120));
      const b = t.getBoundingClientRect();
      const x = b.left + b.width / 2, y = b.top + b.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit !== t && !t.contains(hit) && !hit.contains(t)) out.push(`#${t.id || t.type} covered by ${hit.className || hit.tagName}`);
    }
    return out;
  });
  cover.forEach((m) => note(v, 'form control covered: ' + m));

  // Menu behaviour on narrow screens
  if (w < 1024) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.click('[data-menu-toggle]');
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const nav = document.querySelector('#primary-nav');
      const links = [...nav.querySelectorAll('a')];
      const b = nav.getBoundingClientRect();
      const lastLink = links[links.length - 1].getBoundingClientRect();
      return {
        open: nav.classList.contains('is-open'),
        reachable: lastLink.bottom <= window.innerHeight + 1 || nav.scrollHeight > nav.clientHeight,
        allVisible: lastLink.bottom <= window.innerHeight + 1,
        scrolls: nav.scrollHeight > nav.clientHeight,
        top: Math.round(b.top),
      };
    });
    if (!m.open) note(v, 'menu did not open');
    if (!m.reachable) note(v, 'menu: last item unreachable');
    if (SHOTS) await page.screenshot({ path: `tests/screens/audit/menu-${v}.png` });
    await page.keyboard.press('Escape');
  }

  if (SHOTS) {
    for (const id of ['top', 'about', 'stay', 'book', 'whatsapp', 'adventures', 'contact']) {
      const el = await page.$('#' + id);
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await el.screenshot({ path: `tests/screens/audit/${v}-${id}.png` });
    }
  }
  await ctx.close();
}

await browser.close();
console.log(issues.length ? issues.join('\n') : 'No issues found.');
console.log(`\n${issues.length} issue(s) across ${views.length} viewports`);
process.exitCode = issues.length ? 1 : 0;
