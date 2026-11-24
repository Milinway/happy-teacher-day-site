/* scenes.js — script for the Happy Teacher Day site. */
const { play, type, compose, fx, show, loopify, $ } = Story;

// calendar grid (4x4 date cells), generated once
$("#cells").innerHTML = Array.from({ length: 16 }, (_, i) =>
  `<rect x="${34 + (i % 4) * 36}" y="${76 + Math.floor(i / 4) * 26}" width="28" height="18" rx="4"/>`).join("");

// collage for scene 6: photo set once, loopify duplicates it for the seamless loop
const photos = ["p-kid", "p-award", "p-stairs", "p-y20", "p-summit", "p-juara", "p-gold", "p-cert", "p-gamefy", "p-group"];
$("#collage").innerHTML = photos.map(n => `<img src="img/${n}.jpg" alt="" decoding="async">`).join("");
loopify($("#collage"));
$("#collage").style.setProperty("--dur", "30s");

// One vertical stream of the full phrase, duplicated for a seamless loop.
const col = Object.assign(document.createElement("div"), { className: "col" });
col.style.setProperty("--dur", "14s");
col.innerHTML = "<span>HAPPY TEACHER DAY</span>".repeat(8);
$("#rt").append(col);
loopify(col);

const L = id => $(`#${id} .line`);
const photoAssets = photos.map(n => `img/${n}.jpg`);

play([
  { el: "#s1", run: ctx => type(ctx, L("s1"), "25 November 2026") },
  { el: "#s2", run: ctx => type(ctx, L("s2"), "eh.. emang kenapa ya tanggal tersebut?") },
  {
    el: "#s3",
    run: async ctx => {
      await type(ctx, L("s3"), "ntar deh ku cek dulu");
      show($("#cal"));
      await ctx.sleep(300);
      $("#lens").classList.add("go");
      await ctx.sleep(3300);                 // = lens animation length (3.2s)
      $("#tick").classList.add("draw");
      await ctx.sleep(900);
    },
  },
  {
    el: "#s4",
    run: async ctx => {
      await type(ctx, L("s4"), "oh ternyata hari ini adalah");
      const big = $("#s4 .big");
      show(big, "pop");
      fx.confetti(ctx);
      await ctx.sleep(2200);                 // let the confetti land
    },
  },
  {
    el: "#s5",
    run: async ctx => {
      await compose(ctx, L("s5"), [
        "dari sekian banyak nya guru DHBS, ini ",
        { hl: "spesial", color: "#1c2a7a", then: () => fx.flash("#3b5bdb") },
        " buat ust ku yang paling ",
        { hl: "ASIKX", color: "#1ea34a", then: () => fx.rain(ctx, ["🤘", "🔥", "✨"], { count: 26 }) },
      ]);
      await ctx.sleep(2600);
    },
  },
  {
    el: "#s6", assets: ["img/hero.png", ...photoAssets], manualAdvance: true,
    run: async ctx => {
      $("#s6 .hero").classList.add("enter");
      await ctx.sleep(9000);
    },
  },
  {
    el: "#s7", manualAdvance: true,
    run: async ctx => {
      await ctx.sleep(900);
      $("#s7 .ring").classList.add("pop");
      await ctx.sleep(3200);
    },
  },
  {
    el: "#s8", manualAdvance: true,
    run: async ctx => {
      $("#s8 .polaroids").querySelectorAll("img").forEach(i => i.classList.add("fade-in"));
      await ctx.sleep(4200);
    },
  },
  {
    el: "#s9", manualAdvance: true,
    run: ctx => type(ctx, $("#s9 .para"),
      "big thanks kepada ust rehan yang udah membimbing dan mendampingi syamil di masa sma ini, jujur selama sma ini syamil merasa banyak mendapatkan experience dari berbagai hal seperti, mengikuti lomba, mengenal inovasi, hingga mindset yang terus memotivasi syamil, semoga kedepannya ust rehan bisa lebih keren lagi dan bisa mengajak siswa siswanya berprestasi layaknya prestasi yang ust dapatkan",
      { speed: 24 }),
  },
  {
    el: "#s10",
    run: async ctx => {                       // final scene: stays on screen, CSS loops keep running
      $("#s10 .hero").classList.add("enter");
      await ctx.sleep(1200);
    },
  },
]);
