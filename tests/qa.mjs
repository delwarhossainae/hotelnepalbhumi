// Automated QA for the Hotel Nepal Bhumi site.
// Usage: serve the folder on http://127.0.0.1:8765 then `node tests/qa.mjs`
// Requires Playwright: `npm i -D playwright && npx playwright install chromium`
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8765/';
const widths = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const out = [];
const log = (ok, msg) => out.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
mkdirSync('tests/screens', { recursive: true });
const browser = await chromium.launch();

for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: w < 768 ? 800 : 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - cw;
    const wide = [...document.querySelectorAll('body *')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width && b.right > cw + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.hp,.sr-only,svg,.float-accent,.lightbox,.hero');
    }).slice(0, 3).map((el) => el.className || el.tagName);
    const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')).map((i) => i.src);
    const small = [...document.querySelectorAll('main a:not(p a), main button, main input, main select, main textarea, .site-header a, .site-header button')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width && b.height && b.height < 40 && !el.closest('.hp,.skip-link') && getComputedStyle(el).visibility !== 'hidden';
    }).map((el) => (el.textContent || el.id || el.className).trim().slice(0, 30));
    const h1 = document.querySelector('h1').getBoundingClientRect();
    return { overflow, wide, broken, small, h1Clipped: h1.right > cw || h1.left < 0 };
  });
  log(r.overflow <= 0, `${w}px no horizontal overflow (${r.overflow}px) ${r.wide.join(' | ')}`);
  log(!r.h1Clipped, `${w}px H1 not clipped`);
  log(r.broken.length === 0, `${w}px no broken images ${r.broken.join(', ')}`);
  log(r.small.length === 0, `${w}px tap targets >= 40px ${r.small.slice(0, 5).join(' | ')}`);
  log(errors.length === 0, `${w}px no console errors ${errors.join(' | ')}`);
  await page.screenshot({ path: `tests/screens/home-${w}.png` });
  await page.close();
}

// ---------- Structure + functional checks (mobile 390) ----------
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.context().route(/https:\/\/(wa\.me|api\.whatsapp\.com)\//, (route) => route.fulfill({ status: 200, body: 'stub' }));
await page.goto(BASE, { waitUntil: 'networkidle' });
const s = await page.evaluate(() => {
  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  return {
    dup: ids.filter((id, i) => ids.indexOf(id) !== i),
    h1: document.querySelectorAll('h1').length,
    unsafeExt: [...document.querySelectorAll('a[target="_blank"]')].filter((a) => !/noopener/.test(a.rel) || !/noreferrer/.test(a.rel)).length,
    platforms: [...document.querySelectorAll('.platform')].map((a) => a.href),
    advCards: document.querySelectorAll('.adv-card').length,
    noAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).length,
    noDim: [...document.querySelectorAll('main img')].filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length,
    deadAnchors: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.querySelector(h)),
    ld: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@type'],
    desc: document.querySelector('meta[name="description"]').content.length,
  };
});
log(s.dup.length === 0, `no duplicate IDs ${s.dup}`);
log(s.h1 === 1, `exactly one H1 (${s.h1})`);
log(s.unsafeExt === 0, 'all target=_blank links have rel="noopener noreferrer"');
log(s.platforms.length === 10 && new Set(s.platforms).size === 10, `10 booking platforms, 10 unique URLs`);
log(s.advCards === 7, `7 activity cards (${s.advCards})`);
log(s.noAlt === 0 && s.noDim === 0, 'all images have alt text and width/height');
log(s.deadAnchors.length === 0, `all in-page anchors resolve ${s.deadAnchors}`);
log(s.ld === 'Hotel', `JSON-LD parses (@type ${s.ld})`);
log(s.desc >= 70 && s.desc <= 170, `meta description length ${s.desc}`);

// Mobile menu
await page.click('[data-menu-toggle]');
log(await page.getAttribute('[data-menu-toggle]', 'aria-expanded') === 'true', 'menu opens (aria-expanded=true)');
log(await page.isVisible('#primary-nav a[href="#adventures"]'), 'menu links visible when open');
await page.keyboard.press('Escape');
log(await page.getAttribute('[data-menu-toggle]', 'aria-expanded') === 'false', 'Escape closes menu');
log(await page.evaluate(() => document.activeElement.matches('[data-menu-toggle]')), 'focus returns to menu button');
await page.click('[data-menu-toggle]');
await page.click('#primary-nav a[href="#contact"]');
await page.waitForFunction(() => { const t = document.querySelector('#contact').getBoundingClientRect().top; return t >= 0 && t < 140; }, null, { timeout: 5000 }).catch(() => {});
log(await page.getAttribute('[data-menu-toggle]', 'aria-expanded') === 'false', 'clicking a menu link closes menu');
const contactTop = await page.evaluate(() => document.querySelector('#contact').getBoundingClientRect().top);
log(contactTop >= 0 && contactTop < 140, `anchor scrolls to #contact below sticky header (top=${Math.round(contactTop)})`);

// WhatsApp form
await page.evaluate(() => document.querySelector('#whatsapp').scrollIntoView());
let opened = 0;
page.context().on('page', () => { opened += 1; });
await page.click('#wa-form button[type="submit"]');
const errs = await page.evaluate(() => [...document.querySelectorAll('#wa-form .error')].map((e) => e.textContent).filter(Boolean));
log(errs.length >= 3, `empty submit shows errors: ${errs.join(' / ')}`);
log(opened === 0, 'invalid form does not open WhatsApp');
const day = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
await page.fill('#wa-name', 'Test Guest');
await page.fill('#wa-in', day(-2));
await page.fill('#wa-out', day(1));
await page.click('#wa-form button[type="submit"]');
log(/past/.test(await page.textContent('#wa-in-err')), 'past check-in rejected');
await page.fill('#wa-in', day(10));
await page.fill('#wa-out', day(8));
await page.click('#wa-form button[type="submit"]');
const outErr = await page.textContent('#wa-out-err');
log(/after check-in/.test(outErr), `check-out before check-in rejected ("${outErr}")`);
await page.fill('#wa-out', day(10));
await page.click('#wa-form button[type="submit"]');
log(/after check-in/.test(await page.textContent('#wa-out-err')), 'same-day check-out rejected');
await page.fill('#wa-out', day(13));
await page.fill('#wa-children', '1');
await page.selectOption('#wa-room', 'Family Room');
await page.fill('#wa-notes', 'Late arrival & airport pick-up? 100% thanks #1');
const [popup] = await Promise.all([page.context().waitForEvent('page'), page.click('#wa-form button[type="submit"]')]);
const url = new URL(popup.url());
const text = url.searchParams.get('text') || '';
log(url.hostname === 'wa.me' && url.pathname === '/9779744465391', `WhatsApp opens ${url.origin + url.pathname}`);
log(/Name: Test Guest/.test(text) && /Adults: 2/.test(text) && /Children: 1/.test(text) && /Room preference: Family Room/.test(text)
  && /\(3 nights\)/.test(text) && text.includes('Late arrival & airport pick-up? 100% thanks #1'), 'message contains every field, special characters intact');
log(/confirmed only when/.test(await page.textContent('[data-wa-status]')), 'status message does not claim the booking is confirmed');
out.push('---- generated WhatsApp message ----\n' + text + '\n------------------------------------');
await popup.close();

// Activity enquiry links
const adv = await page.$$eval('.adv-cta', (as) => as.map((a) => [a.dataset.activity, new URL(a.href).searchParams.get('text') || '', new URL(a.href).pathname]));
log(adv.length === 7 && adv.every(([name, t, p]) => t.includes(`interested in: ${name}`) && p === '/9779744465391'), 'each activity enquiry pre-fills its own activity name');

// Gallery + lightbox
await page.evaluate(() => document.querySelector('#stay').scrollIntoView());
await page.click('.chip[data-filter="rooms"]');
const visible = await page.$$eval('.g-item', (els) => els.filter((e) => !e.hidden).length);
log(visible === 6, `filter "Rooms" shows 6 photos (${visible})`);
await page.click('.chip[data-filter="all"]');
await page.click('.g-item:first-child .g-btn');
await page.waitForTimeout(400);
log(await page.isVisible('[data-lightbox]'), 'lightbox opens');
log(await page.evaluate(() => document.activeElement.matches('[data-lb-close]')), 'focus moves into lightbox');
const c1 = await page.textContent('[data-lb-count]');
await page.keyboard.press('ArrowRight');
const c2 = await page.textContent('[data-lb-count]');
log(c1 === '1 / 12' && c2 === '2 / 12', `ArrowRight navigates (${c1} -> ${c2})`);
await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
log(await page.textContent('[data-lb-count]') === '12 / 12', 'previous wraps to last photo');
await page.click('[data-lb-next]');
log(await page.textContent('[data-lb-count]') === '1 / 12', 'next button works');
const imgOk = await page.evaluate(() => new Promise((r) => { const i = document.querySelector('[data-lb-img]'); if (i.complete) r(i.naturalWidth > 0); else { i.onload = () => r(true); i.onerror = () => r(false); } }));
log(imgOk, 'lightbox full-size image loads');
await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
log(await page.evaluate(() => !!document.activeElement.closest('[data-lightbox]')), 'Tab focus stays trapped in lightbox');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
log(!(await page.isVisible('[data-lightbox]')), 'Escape closes lightbox');
log(await page.evaluate(() => document.activeElement.matches('.g-item:first-child .g-btn')), 'focus returns to the thumbnail');

// Floating WhatsApp hidden over the form
await page.evaluate(() => document.querySelector('#wa-form').scrollIntoView({ block: 'center', behavior: 'instant' }));
await page.waitForTimeout(800);
log(await page.evaluate(() => document.querySelector('.wa-float').classList.contains('is-hidden')), 'floating WhatsApp button hides while the booking form is on screen');

// WhatsApp form on a phone: steppers, default check-out, live summary
const ph = await browser.newPage({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });
await ph.goto(BASE, { waitUntil: 'networkidle' });
await ph.locator('#wa-form').scrollIntoViewIfNeeded();
await ph.fill('#wa-in', day(5));
log(await ph.inputValue('#wa-out') === day(6), 'choosing check-in pre-fills a 1-night check-out');
log(/1 night · 2 adults/.test(await ph.textContent('[data-stay-summary]')), `stay summary shown ("${await ph.textContent('[data-stay-summary]')}")`);
await ph.tap('[aria-label="More adults"]'); await ph.tap('[aria-label="More children"]');
log(await ph.inputValue('#wa-adults') === '3' && await ph.inputValue('#wa-children') === '1', 'guest +/- steppers work by tap');
log(/3 adults · 1 child/.test(await ph.textContent('[data-stay-summary]')), 'summary updates with guests');
await ph.tap('[aria-label="Fewer children"]');
log(await ph.isDisabled('[aria-label="Fewer children"]'), 'minus disabled at minimum (0 children)');
const fs = await ph.$$eval('#wa-form input:not([type=hidden]), #wa-form select, #wa-form textarea', (els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
log(fs.every((x) => x >= 16), `form fields use >= 16px text (no iOS zoom): ${[...new Set(fs)].join(',')}px`);
await ph.fill('#wa-in', '');
await ph.locator('#wa-form button[type="submit"]').scrollIntoViewIfNeeded();
await ph.tap('#wa-form button[type="submit"]');
await ph.waitForTimeout(600);
const nameBox = await ph.evaluate(() => { const b = document.querySelector('#wa-name').getBoundingClientRect(); return { top: b.top, focused: document.activeElement.id }; });
log(nameBox.focused === 'wa-name' && nameBox.top > 60 && nameBox.top < 667, `first invalid field focused and visible below header (top=${Math.round(nameBox.top)})`);
await ph.close();

// Reduced motion: no running animations, no parallax
const rmp = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await rmp.goto(BASE, { waitUntil: 'networkidle' });
await rmp.waitForTimeout(300);
const running = await rmp.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().duration > 50).length);
log(running === 0, `reduced motion: no running animations (${running})`);
await rmp.mouse.wheel(0, 400); await rmp.waitForTimeout(300);
log(await rmp.evaluate(() => !document.querySelector('.hero-img').style.translate), 'reduced motion: hero parallax disabled');
await rmp.close();

// Desktop header
const dp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await dp.goto(BASE, { waitUntil: 'networkidle' });
log(!(await dp.evaluate(() => document.querySelector('[data-header]').classList.contains('is-solid'))), 'desktop header transparent over hero');
await dp.mouse.wheel(0, 900); await dp.waitForTimeout(600);
log(await dp.evaluate(() => document.querySelector('[data-header]').classList.contains('is-solid')), 'desktop header turns solid on scroll');
log(await dp.isVisible('#primary-nav a[href="#book"]') && !(await dp.isVisible('[data-menu-toggle]')), 'desktop shows inline nav, hides menu button');
await dp.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } }); await dp.waitForTimeout(900);
await dp.screenshot({ path: 'tests/screens/desktop-full.png', fullPage: true });

// Reduced motion
const rm = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await rm.goto(BASE, { waitUntil: 'networkidle' });
const op = await rm.evaluate(() => getComputedStyle(document.querySelector('#about .about-copy')).opacity);
log(op === '1', `reduced motion: below-fold content visible without animation (opacity ${op})`);

// Mobile full-page screenshot
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mp.goto(BASE, { waitUntil: 'networkidle' });
await mp.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
await mp.waitForTimeout(600);
await mp.screenshot({ path: 'tests/screens/mobile-full.png', fullPage: true });

await browser.close();
console.log(out.join('\n'));
const fails = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`\n${out.filter((l) => l.startsWith('PASS')).length} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
