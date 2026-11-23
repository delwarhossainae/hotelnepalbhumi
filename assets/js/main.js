/* Hotel Nepal Bhumi — site interactions (vanilla JS, no dependencies)
 * Designed and developed by MH — https://www.hossain.me/
 * The footer credit "Developed by MH" is required attribution and must not be removed. */
(() => {
  'use strict';

  const WA_NUMBER = '9779744465391'; // +977 974-4465391 (international format, digits only)
  const HOTEL = 'Hotel Nepal Bhumi';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

  /* ---------- Non-blocking web fonts ---------- */
  const gf = document.getElementById('gfonts');
  if (gf) { if (gf.sheet) gf.media = 'all'; else gf.addEventListener('load', () => { gf.media = 'all'; }); }

  /* ---------- Footer year ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  /* ---------- Developer credit (required attribution, see README "Credits") ---------- */
  const CREDIT_URL = 'https://www.hossain.me/';
  const ensureCredit = () => {
    const bar = $('.footer-bottom') || $('.site-footer') || document.body;
    const all = $$('.credit');
    all.slice(1).forEach((el) => el.remove());
    let p = all[0] || null;
    let a = p && p.querySelector('a');
    const ok = a && a.href === CREDIT_URL && a.textContent.trim() === 'MH' && /Developed by/.test(p.textContent);
    if (ok) {
      const cs = getComputedStyle(p); const ca = getComputedStyle(a);
      const shown = p.getClientRects().length && a.getClientRects().length && cs.visibility === 'visible' && ca.visibility === 'visible'
        && Number(cs.opacity) > 0.5 && Number(ca.opacity) > 0.5 && parseFloat(cs.fontSize) >= 10 && ca.color !== cs.backgroundColor
        && p.closest('body') && !p.closest('[hidden],[aria-hidden="true"]');
      if (shown) return bar;
    }
    if (!ok) {
      if (p) p.remove();
      p = document.createElement('p');
      p.className = 'credit';
      p.append('Developed by ');
      a = document.createElement('a');
      a.href = CREDIT_URL; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', 'Developed by MH, visit portfolio at hossain.me (opens in a new tab)');
      a.textContent = 'MH';
      p.append(a);
      bar.append(p);
    }
    p.hidden = false; a.hidden = false;
    for (const el of [p, a]) {
      el.style.setProperty('display', el === p ? 'block' : 'inline-flex', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('position', 'static', 'important');
      el.style.setProperty('font-size', el === p ? '0.82rem' : 'inherit', 'important');
    }
    a.style.setProperty('color', '#C5A46D', 'important');
    p.style.setProperty('color', 'rgba(255,255,255,.78)', 'important');
    if (!p.getClientRects().length || p.closest('[hidden],[aria-hidden="true"]')) {
      // Footer itself was hidden: show the credit as its own bar at the end of the page.
      p.style.setProperty('background', '#0f2a23', 'important');
      p.style.setProperty('padding', '8px 16px', 'important');
      p.style.setProperty('margin', '0', 'important');
      p.style.setProperty('text-align', 'center', 'important');
      document.body.append(p);
      return document.body;
    }
    return bar;
  };
  if ('MutationObserver' in window) {
    let queued = false;
    let watched = null;
    const footerObs = new MutationObserver(() => schedule());
    const watch = (bar) => {
      footerObs.takeRecords(); // ignore our own repairs
      if (bar === watched || bar === document.body) return;
      footerObs.disconnect();
      footerObs.observe(bar, { childList: true, subtree: true, attributes: true, characterData: true });
      watched = bar;
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; watch(ensureCredit()); });
    };
    watch(ensureCredit());
    new MutationObserver(schedule).observe(document.body, { childList: true });
    new MutationObserver(schedule).observe(document.head, { childList: true, subtree: true, characterData: true });
    setInterval(schedule, 3000);
  } else {
    ensureCredit();
  }

  /* ---------- Header: solid on scroll ---------- */
  const header = $('[data-header]');
  const nav = $('#primary-nav');
  const toggle = $('[data-menu-toggle]');
  const setHeader = () => header.classList.toggle('is-solid', window.scrollY > 40 || nav.classList.contains('is-open'));
  setHeader();
  window.addEventListener('scroll', setHeader, { passive: true });

  /* ---------- Mobile menu ---------- */
  const desktopMq = window.matchMedia('(min-width: 1024px)');
  const closeMenu = (returnFocus = false) => {
    if (!nav.classList.contains('is-open')) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.sr-only').textContent = 'Open menu';
    setHeader();
    if (returnFocus) toggle.focus();
  };
  const openMenu = () => {
    nav.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.querySelector('.sr-only').textContent = 'Close menu';
    setHeader();
    const first = nav.querySelector('a');
    if (first) first.focus();
  };
  toggle.addEventListener('click', () => (nav.classList.contains('is-open') ? closeMenu() : openMenu()));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(true); });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  });
  desktopMq.addEventListener('change', () => closeMenu());

  /* ---------- Active nav link ---------- */
  const navLinks = $$('.primary-nav ul a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const navObs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = '#' + entry.target.id;
        navLinks.forEach((a) => {
          const on = a.getAttribute('href') === id;
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => navObs.observe(s));
  }

  /* ---------- Reveal on scroll ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); obs.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Subtle hero parallax (desktop, fine pointer, motion allowed) ---------- */
  const heroImg = $('.hero-img');
  const canParallax = heroImg && !reduceMotion && window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches
    && (navigator.hardwareConcurrency || 4) >= 4;
  if (canParallax) {
    let ticking = false;
    const update = () => {
      const y = Math.min(window.scrollY, window.innerHeight);
      heroImg.style.translate = `0 ${(y * 0.18).toFixed(1)}px`;
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  }

  /* ---------- Floating WhatsApp: hide when it would cover the form or footer ---------- */
  const waFloat = $('.wa-float');
  const waForm = $('#wa-form');
  const footer = $('.site-footer');
  if (waFloat && 'IntersectionObserver' in window) {
    const hiders = new Set();
    const floatObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? hiders.add(e.target) : hiders.delete(e.target)));
      waFloat.classList.toggle('is-hidden', hiders.size > 0);
    }, { threshold: 0.05 });
    [waForm, footer].forEach((el) => el && floatObs.observe(el));
  }

  /* ---------- Mobile booking bar: shown after the hero, hidden over the form/footer ---------- */
  const bookBar = $('.book-bar');
  const hero = $('.hero');
  if (bookBar && hero && 'IntersectionObserver' in window) {
    const state = { hero: true, cover: new Set() };
    const apply = () => {
      const show = !state.hero && state.cover.size === 0;
      bookBar.classList.toggle('is-visible', show);
      bookBar.setAttribute('aria-hidden', String(!show));
      bookBar.querySelectorAll('a').forEach((a) => { a.tabIndex = show ? 0 : -1; });
    };
    new IntersectionObserver(([e]) => { state.hero = e.isIntersecting; apply(); }, { threshold: 0.15 }).observe(hero);
    const coverObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? state.cover.add(e.target) : state.cover.delete(e.target)));
      apply();
    }, { threshold: 0.05 });
    [waForm, footer].forEach((el) => el && coverObs.observe(el));
    apply();
  }

  /* ---------- Adventure enquiry links ---------- */
  $$('.adv-cta[data-activity]').forEach((a) => {
    const activity = a.dataset.activity;
    a.href = waLink(
      `Hello ${HOTEL},\n\nI'm interested in: ${activity}.\n\nCould you share more information and help me plan it?\n\nThank you.`
    );
    a.setAttribute('aria-label', `Enquire about ${activity} on WhatsApp (opens in a new tab)`);
  });

  /* ---------- WhatsApp booking form ---------- */
  if (waForm) {
    const f = {
      name: $('#wa-name'), checkin: $('#wa-in'), checkout: $('#wa-out'),
      adults: $('#wa-adults'), children: $('#wa-children'), room: $('#wa-room'), notes: $('#wa-notes'),
    };
    const status = $('[data-wa-status]', waForm);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const parse = (v) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
    const pretty = (v) => parse(v).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const today = iso(new Date());
    f.checkin.min = today;
    f.checkout.min = today;
    f.checkin.addEventListener('change', () => {
      if (!f.checkin.value) return;
      const next = parse(f.checkin.value); next.setDate(next.getDate() + 1);
      f.checkout.min = iso(next);
      // Smartphone-friendly default: suggest a 1-night stay so guests don't have to open a second date picker.
      if (!f.checkout.value || f.checkout.value <= f.checkin.value) f.checkout.value = iso(next);
      updateSummary();
    });
    f.checkout.addEventListener('change', () => updateSummary());

    /* Live stay summary, e.g. "3 nights · 2 adults · 1 child" */
    const summary = $('[data-stay-summary]', waForm);
    function updateSummary() {
      if (!summary) return;
      const a = Number(f.adults.value) || 0;
      const c = Number(f.children.value) || 0;
      const guests = `${a} adult${a === 1 ? '' : 's'}${c ? ` · ${c} child${c === 1 ? '' : 'ren'}` : ''}`;
      if (f.checkin.value && f.checkout.value && f.checkout.value > f.checkin.value) {
        const n = Math.round((parse(f.checkout.value) - parse(f.checkin.value)) / 86400000);
        summary.textContent = `${n} night${n === 1 ? '' : 's'} · ${guests}`;
      } else {
        summary.textContent = '';
      }
    }

    /* +/− steppers for guests (large touch targets, no tiny native spinners) */
    const syncSteppers = () => $$('.stepper', waForm).forEach((st) => {
      const input = $('input', st);
      const val = Number(input.value) || 0;
      $$('.step-btn', st).forEach((b) => {
        const d = Number(b.dataset.step);
        b.disabled = d < 0 ? val <= Number(input.min) : val >= Number(input.max);
      });
    });
    $$('.step-btn', waForm).forEach((b) => b.addEventListener('click', () => {
      const input = $('#' + b.getAttribute('aria-controls'));
      const min = Number(input.min), max = Number(input.max);
      const next = Math.min(max, Math.max(min, (Number(input.value) || 0) + Number(b.dataset.step)));
      input.value = String(next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    [f.adults, f.children].forEach((i) => i.addEventListener('input', () => { syncSteppers(); updateSummary(); }));
    syncSteppers();

    const setErr = (input, msg) => {
      const el = $('#' + input.id + '-err');
      if (el) el.textContent = msg;
      if (msg) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', input.id + '-err'); }
      else input.removeAttribute('aria-invalid');
      return !msg;
    };

    const validate = () => {
      const errs = [];
      const name = f.name.value.trim();
      errs.push(setErr(f.name, name.length < 2 ? 'Please enter your name.' : ''));
      errs.push(setErr(f.checkin, !f.checkin.value ? 'Please choose a check-in date.'
        : f.checkin.value < today ? 'Check-in cannot be in the past.' : ''));
      errs.push(setErr(f.checkout, !f.checkout.value ? 'Please choose a check-out date.'
        : (f.checkin.value && f.checkout.value <= f.checkin.value) ? 'Check-out must be after check-in.' : ''));
      const adults = Number(f.adults.value);
      errs.push(setErr(f.adults, !Number.isInteger(adults) || adults < 1 || adults > 20 ? 'Enter 1–20 adults.' : ''));
      const kids = f.children.value === '' ? 0 : Number(f.children.value);
      errs.push(setErr(f.children, !Number.isInteger(kids) || kids < 0 || kids > 20 ? 'Enter 0–20 children.' : ''));
      return errs.every(Boolean);
    };

    waForm.addEventListener('submit', (e) => {
      e.preventDefault();
      status.textContent = '';
      if (!validate()) {
        const bad = waForm.querySelector('[aria-invalid="true"]');
        if (bad) {
          bad.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
          bad.focus({ preventScroll: true });
        }
        return;
      }
      const nights = Math.round((parse(f.checkout.value) - parse(f.checkin.value)) / 86400000);
      const lines = [
        `Hello ${HOTEL},`, '',
        'I would like to enquire about room availability.', '',
        `Name: ${f.name.value.trim()}`,
        `Check-in: ${pretty(f.checkin.value)}`,
        `Check-out: ${pretty(f.checkout.value)} (${nights} night${nights === 1 ? '' : 's'})`,
        `Adults: ${Number(f.adults.value)}`,
        `Children: ${f.children.value === '' ? 0 : Number(f.children.value)}`,
        `Room preference: ${f.room.value || 'No preference'}`,
      ];
      const notes = f.notes.value.trim();
      if (notes) lines.push(`Additional requests: ${notes}`);
      lines.push('', 'Please confirm availability and the best available rate.', '', 'Thank you.');
      const url = waLink(lines.join('\n'));
      const win = window.open(url, '_blank');
      if (win) { try { win.opener = null; } catch (_) { /* ignore */ } } else { window.location.href = url; }
      status.textContent = 'WhatsApp opened with your enquiry. Please press send there — your booking is confirmed only when our team replies.';
    });

    Object.values(f).forEach((input) => input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') setErr(input, '');
    }));
  }

  /* ---------- Gallery filters ---------- */
  const galleryItems = $$('[data-gallery] .g-item');
  $$('.gallery-filters .chip').forEach((chip, _, chips) => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.filter;
      chips.forEach((c) => { const on = c === chip; c.classList.toggle('is-active', on); c.setAttribute('aria-pressed', String(on)); });
      galleryItems.forEach((li) => { li.hidden = cat !== 'all' && li.dataset.cat !== cat; });
    });
  });

  /* ---------- Lightbox ---------- */
  const lb = $('[data-lightbox]');
  if (lb) {
    const img = $('[data-lb-img]', lb);
    const cap = $('[data-lb-cap]', lb);
    const count = $('[data-lb-count]', lb);
    const focusables = $$('button', lb);
    let list = [];
    let index = 0;
    let lastFocus = null;

    const show = (i) => {
      index = (i + list.length) % list.length;
      const btn = list[index];
      const thumb = btn.querySelector('img');
      img.src = btn.dataset.full;
      img.alt = thumb.alt;
      cap.textContent = btn.querySelector('.g-cap')?.textContent || '';
      count.textContent = `${index + 1} / ${list.length}`;
    };
    const open = (btn) => {
      list = galleryItems.filter((li) => !li.hidden).map((li) => li.querySelector('.g-btn'));
      lastFocus = btn;
      show(list.indexOf(btn));
      lb.hidden = false;
      document.body.classList.add('no-scroll');
      requestAnimationFrame(() => lb.classList.add('is-open'));
      $('[data-lb-close]', lb).focus();
    };
    const close = () => {
      lb.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      const done = () => { lb.hidden = true; img.removeAttribute('src'); };
      if (reduceMotion) done(); else setTimeout(done, 250);
      if (lastFocus) lastFocus.focus();
    };

    $$('[data-gallery] .g-btn').forEach((btn) => btn.addEventListener('click', () => open(btn)));
    $('[data-lb-close]', lb).addEventListener('click', close);
    $('[data-lb-prev]', lb).addEventListener('click', () => show(index - 1));
    $('[data-lb-next]', lb).addEventListener('click', () => show(index + 1));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
      else if (e.key === 'Tab') {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    let touchX = null;
    lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      touchX = null;
    });
  }

  /* ---------- Optional email contact form (enabled only if api/contact.php is configured) ---------- */
  const cf = $('#contact-form');
  if (cf && window.fetch && location.protocol.startsWith('http')) {
    const cfStatus = $('[data-cf-status]', cf);
    fetch('api/contact.php', { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !data.enabled) return;
        cf.elements.csrf.value = data.csrf;
        cf.elements.ts.value = data.ts;
        cf.hidden = false;
      })
      .catch(() => { /* PHP not available: keep the form hidden; WhatsApp and phone remain. */ });

    cf.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!cf.checkValidity()) { cf.reportValidity(); return; }
      const btn = cf.querySelector('button[type="submit"]');
      btn.disabled = true;
      cfStatus.textContent = 'Sending…';
      try {
        const res = await fetch('api/contact.php', { method: 'POST', body: new FormData(cf), credentials: 'same-origin', headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          cfStatus.textContent = 'Thank you — your message has been sent. We will reply as soon as possible.';
          cf.reset();
        } else {
          cfStatus.textContent = (data && data.error) || 'Sorry, your message could not be sent. Please contact us on WhatsApp or by phone.';
        }
      } catch (_) {
        cfStatus.textContent = 'Sorry, your message could not be sent. Please contact us on WhatsApp or by phone.';
      } finally {
        btn.disabled = false;
      }
    });
  }
})();
