/* engine.js — tiny reusable toolkit for scene-by-scene animated sites.
 * No dependencies. Exposes one global: Story.
 * Each scene gets a `ctx`; everything it starts (timers, listeners, particles)
 * is registered on ctx so leaving the scene cleans it up automatically. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FAST = new URLSearchParams(location.search).has("fast");   // ?fast compresses waits ~20x (testing only)
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- per-scene context ---------- */
  function makeCtx(el) {
    const timers = new Set(), cleanups = [];
    const ctx = {
      el, dead: false,
      sleep: ms => new Promise(res => {
        if (ctx.dead) return;
        const id = setTimeout(() => { timers.delete(id); res(); }, FAST ? ms / 20 : reduce ? Math.min(ms, 80) : ms);
        timers.add(id);
      }),
      on(target, evt, fn, opts) { target.addEventListener(evt, fn, opts); cleanups.push(() => target.removeEventListener(evt, fn, opts)); },
      onCleanup: fn => cleanups.push(fn),
      destroy() { ctx.dead = true; timers.forEach(clearTimeout); cleanups.forEach(f => f()); cleanups.length = 0; },
    };
    return ctx;
  }

  /* ---------- text: per-letter typing ---------- */
  // Types `text` into `el` one character at a time. Reuse for every typed line.
  async function type(ctx, el, text, { speed = 55, caret = true } = {}) {
    const node = document.createTextNode("");
    el.append(node);
    if (caret) el.classList.add("caret");
    for (const ch of text) {
      node.data += ch;
      await ctx.sleep(speed);
    }
    if (caret) el.classList.remove("caret");
  }

  // Reveals the words of `el` one by one with the .pop animation.
  async function popWords(ctx, el, { gap = 220 } = {}) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    const spans = words.map((w, i) => {
      const s = document.createElement("span");
      s.className = "hidden"; s.textContent = w; s.style.display = "inline-block";
      el.append(s); if (i < words.length - 1) el.append(" ");
      return s;
    });
    for (const s of spans) { s.className = "pop"; await ctx.sleep(gap); }
  }

  /* Mixed line: plain strings are typed per letter, {hl} parts are boxes that pop per word.
   * parts: ["dari sekian ", {hl:"spesial", cls:"", then: () => fx.flash()}, " buat ust ku"]
   * `then` fires when the box finishes appearing (use it to trigger a one-off effect). */
  async function compose(ctx, el, parts, opts = {}) {
    for (const p of parts) {
      if (typeof p === "string") { await type(ctx, el, p, { ...opts, caret: false }); continue; }
      const box = document.createElement("span");
      box.className = "hl " + (p.cls || ""); box.textContent = p.hl;
      if (p.color) box.style.setProperty("--hl", p.color);
      el.append(box);
      await popWords(ctx, box, { gap: p.gap || 220 });
      if (p.then) p.then();
    }
  }

  /* ---------- effects ---------- */
  const fx = {
    // Full-screen colour blink (surprise).
    flash(color) {
      const f = $("#flash");
      if (color) f.style.setProperty("--flash", color);
      f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
    },

    // Falling emoji/text pieces driven by CSS only; nodes remove themselves.
    rain(ctx, glyphs, { count = 28, size = [24, 44], duration = [1.6, 3.2], spread = 1800 } = {}) {
      const list = Array.isArray(glyphs) ? glyphs : [glyphs];
      for (let i = 0; i < count; i++) {
        const t = setTimeout(() => {
          if (ctx.dead) return;
          const s = document.createElement("span");
          s.className = "rain-item"; s.textContent = list[i % list.length];
          s.style.cssText = `left:${rand(0, 96)}vw;font-size:${rand(...size)}px;animation-duration:${rand(...duration)}s;--rot:${rand(-90, 90)}deg`;
          s.addEventListener("animationend", () => s.remove(), { once: true });
          document.body.append(s);
          ctx.onCleanup(() => s.remove());
        }, rand(0, spread));
        ctx.onCleanup(() => clearTimeout(t));
      }
    },

    // Canvas confetti. One short rAF loop that stops itself when particles are gone.
    confetti(ctx, { count = 140, colors = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93"], origin = [0.5, 0.45] } = {}) {
      if (reduce) return;
      const cv = $("#fx"), c = cv.getContext("2d"), dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      const ps = Array.from({ length: count }, () => ({
        x: origin[0] * cv.width, y: origin[1] * cv.height,
        vx: rand(-9, 9) * dpr, vy: rand(-16, -4) * dpr, g: 0.38 * dpr,
        w: rand(6, 11) * dpr, h: rand(3, 6) * dpr, r: rand(0, 6.28), vr: rand(-.3, .3),
        col: colors[(Math.random() * colors.length) | 0],
      }));
      let raf;
      const step = () => {
        c.clearRect(0, 0, cv.width, cv.height);
        let alive = 0;
        for (const p of ps) {
          p.vy += p.g; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
          if (p.y < cv.height + 30) alive++;
          c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
        }
        if (alive && !ctx.dead) raf = requestAnimationFrame(step); else c.clearRect(0, 0, cv.width, cv.height);
      };
      raf = requestAnimationFrame(step);
      ctx.onCleanup(() => { cancelAnimationFrame(raf); c.clearRect(0, 0, cv.width, cv.height); });
    },
  };

  /* ---------- small helpers ---------- */
  const show = (el, cls = "fade-in") => { el.removeAttribute("hidden"); el.classList.add(cls); };

  // Duplicate children once so a translateX(-50%) loop is seamless (marquee / falling columns).
  const loopify = el => { el.innerHTML += el.innerHTML; };

  // Resolves when every image is loaded (or failed — a missing image must not stall the story).
  const preload = urls => Promise.all(urls.map(u => new Promise(res => {
    const i = new Image(); i.onload = i.onerror = res; i.src = u;
  })));

  /* ---------- optional music (never required, never blocks) ---------- */
  function initAudio(src, { volume = 0.5 } = {}) {
    const btn = $("#audio-toggle"); if (!btn) return;
    const a = new Audio(src); a.loop = true; a.volume = volume; a.preload = "none";
    btn.hidden = false;
    btn.addEventListener("click", () => {
      const on = btn.getAttribute("aria-pressed") !== "true";
      btn.setAttribute("aria-pressed", on);
      on ? a.play().catch(() => btn.setAttribute("aria-pressed", false)) : a.pause();
    });
  }

  /* ---------- runner ---------- */
  // defs: [{ el:"#s1", assets:[...urls], run: async ctx => {...} }, ...]
  // The next scene starts two seconds after `run` resolves, or immediately on button click.
  // The last scene is never torn down, so its looping background keeps running.
  async function play(defs) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    let next = preload(defs[0].assets || []);
    const nextButton = $("#next-scene");
    const restartButton = $("#restart-site");
    restartButton.onclick = () => location.reload();
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i], el = $(d.el);
      await next;
      next = preload((defs[i + 1] && defs[i + 1].assets) || []);   // warm the next scene while this one plays
      const ctx = makeCtx(el);
      nextButton.hidden = true;
      nextButton.onclick = null;
      restartButton.hidden = true;
      el.classList.add("active");
      document.dispatchEvent(new CustomEvent("scene:start", { detail: { index: i, id: d.el } }));
      await d.run(ctx, el);
      const end = { index: i, id: d.el, last: i === defs.length - 1 };
      document.dispatchEvent(new CustomEvent("scene:end", { detail: end }));
      if (FAST) await new Promise(r => { window.__held = end; window.__release = () => { window.__held = null; r(); }; });  // test harness: hold here so the scene can be screenshotted
      if (i === defs.length - 1) {
        restartButton.hidden = false;
        return;                                                     // STAY on the final scene
      }
      const showNextButton = i >= 5;
      nextButton.hidden = !showNextButton;
      await new Promise(resolve => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          nextButton.removeEventListener("click", finish);
          resolve();
        };
        const timer = d.manualAdvance ? null : setTimeout(finish, FAST ? 2000 / 20 : 2000);
        if (showNextButton) nextButton.addEventListener("click", finish, { once: true });
      });
      nextButton.hidden = true;
      el.classList.remove("active");
      await ctx.sleep(parseInt(getComputedStyle(document.documentElement).getPropertyValue("--fade")) || 600); // let the fade-out finish
      ctx.destroy();
    }
  }

  window.Story = { play, type, popWords, compose, fx, show, loopify, preload, initAudio, $, reduce };
})();
