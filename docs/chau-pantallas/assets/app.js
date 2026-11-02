/* Chau Pantallas: interacción, Meta Pixel, pop-up de regalo y animaciones. */
(function () {
  "use strict";
  var CP = window.CP || {};
  var d = document;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var scriptSrc = (d.currentScript && d.currentScript.src) || "";

  function store(k, v) {
    try {
      if (v === undefined) return window.localStorage.getItem(k);
      window.localStorage.setItem(k, v);
    } catch (e) { return null; }
  }

  /* ---------- Meta Pixel ---------- */
  function track(ev, params) {
    try { if (typeof window.fbq === "function") window.fbq("track", ev, params || {}); } catch (e) {}
  }
  var pixelBase = { content_name: CP.producto, content_type: "product", value: CP.valor, currency: CP.moneda };

  var vcSent = false;
  function onScrollPct() {
    var h = d.documentElement;
    var pct = (h.scrollTop || d.body.scrollTop) / Math.max(1, h.scrollHeight - h.clientHeight);
    if (!vcSent && pct >= 0.5) { vcSent = true; track("ViewContent", pixelBase); }
    if (pct >= 0.6) maybePopup("scroll");
  }
  window.addEventListener("scroll", onScrollPct, { passive: true });

  $$("[data-buy]").forEach(function (a) {
    a.addEventListener("click", function () {
      track("InitiateCheckout", pixelBase);
      try { sessionStorage.setItem("cp_compra", "1"); } catch (e) {}
    });
  });

  /* ---------- Precio de lanzamiento: se esconde solo después de la fecha ---------- */
  if (CP.promoHasta) {
    var fin = new Date(CP.promoHasta + "T23:59:59");
    if (new Date() > fin) $$(".promo").forEach(function (el) { el.hidden = true; el.style.display = "none"; });
  }

  /* ---------- ¿Te pasa esto? ---------- */
  var cuenta = $(".dolor-cuenta");
  $$(".dolor").forEach(function (b) {
    b.addEventListener("click", function () {
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
      var n = $$('.dolor[aria-pressed="true"]').length;
      if (cuenta) cuenta.textContent = n ? CP.dolorCuenta.replace("{n}", n) : "";
    });
  });

  /* ---------- Barra fija de compra (mobile) ---------- */
  var sticky = $(".sticky");
  if (sticky && "IntersectionObserver" in window) {
    var heroCta = $(".hero-cta .btn");
    var zonas = [$("#precio"), $("#final")];
    var visibles = new Set();
    var heroVisible = true;
    var upd = function () {
      var on = !heroVisible && visibles.size === 0;
      sticky.classList.toggle("on", on);
      sticky.setAttribute("aria-hidden", on ? "false" : "true");
    };
    new IntersectionObserver(function (es) { es.forEach(function (x) { heroVisible = x.isIntersecting || x.boundingClientRect.top > 0; }); upd(); }).observe(heroCta);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) visibles.add(x.target); else visibles.delete(x.target); });
      upd();
    }, { rootMargin: "0px 0px -15% 0px" });
    zonas.forEach(function (z) { if (z) io.observe(z); });
  }

  /* ---------- Carrusel de páginas + visor ---------- */
  var track_ = $(".track");
  if (track_) {
    var slides = $$(".slide", track_);
    var pos = $(".carrusel-pos");
    var prev = $('.nav-btn[data-dir="-1"]');
    var next = $('.nav-btn[data-dir="1"]');
    var idx = function () {
      var x = track_.scrollLeft, best = 0, bd = 1e9;
      slides.forEach(function (s, i) { var dd = Math.abs(s.offsetLeft - track_.offsetLeft - x - parseFloat(getComputedStyle(track_).paddingLeft) + 0); if (dd < bd) { bd = dd; best = i; } });
      return best;
    };
    var updNav = function () {
      var i = idx();
      if (pos) pos.textContent = (i + 1) + " / " + slides.length;
      if (prev) prev.disabled = track_.scrollLeft < 4;
      if (next) next.disabled = track_.scrollLeft + track_.clientWidth >= track_.scrollWidth - 4;
    };
    var t0;
    track_.addEventListener("scroll", function () { clearTimeout(t0); t0 = setTimeout(updNav, 60); }, { passive: true });
    $$(".nav-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var w = slides[0].getBoundingClientRect().width + 16;
        track_.scrollBy({ left: w * Number(b.dataset.dir), behavior: reduce ? "auto" : "smooth" });
      });
    });
    updNav();
    var visor = $("#visor");
    $$(".slide-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!visor || typeof visor.showModal !== "function") { window.open(b.dataset.full, "_blank"); return; }
        var im = $("img", visor);
        im.src = b.dataset.full; im.alt = b.dataset.cap;
        $(".visor-cap", visor).textContent = b.dataset.cap;
        visor.showModal();
      });
    });
    if (visor) visor.addEventListener("click", function (ev) { if (ev.target === visor) visor.close(); });
  }

  /* ---------- Pop-up de regalo (5 frases) ---------- */
  var modal = $("#regalo");
  var popupShown = false;
  var startT = Date.now();
  function abrirRegalo() {
    if (!modal || typeof modal.showModal !== "function" || modal.open) return;
    popupShown = true;
    store("cp_regalo_visto", String(Date.now()));
    modal.showModal();
  }
  function maybePopup(origen) {
    if (popupShown || !modal) return;
    if (Date.now() - startT < 6000) return;
    try { if (sessionStorage.getItem("cp_compra")) return; } catch (e) {}
    var visto = Number(store("cp_regalo_visto") || 0);
    if (visto && Date.now() - visto < 3 * 24 * 3600 * 1000) { popupShown = true; return; }
    if (d.querySelector("dialog[open]")) return;
    abrirRegalo();
  }
  d.addEventListener("mouseout", function (ev) {
    if (!ev.relatedTarget && ev.clientY <= 0) maybePopup("salida");
  });
  $$("[data-regalo]").forEach(function (b) { b.addEventListener("click", abrirRegalo); });
  if (modal) modal.addEventListener("click", function (ev) { if (ev.target === modal) modal.close(); });

  var form = $("#lead");
  if (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var inp = $("#lead-c"), err = $("#lead-err");
      var v = (inp.value || "").trim();
      var esMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      var esTel = v.replace(/\D/g, "").length >= 8 && /^[+\d\s().-]+$/.test(v);
      if (!esMail && !esTel) { err.hidden = false; inp.setAttribute("aria-invalid", "true"); inp.focus(); return; }
      err.hidden = true; inp.removeAttribute("aria-invalid");
      track("Lead", { content_name: CP.producto + " - 5 frases" });
      // 1) descarga el PDF
      var a = d.createElement("a");
      a.href = CP.regalo; a.download = ""; d.body.appendChild(a); a.click(); a.remove();
      // 2) abre WhatsApp con el pedido
      var msg = CP.waLead.replace("{c}", v);
      window.open("https://wa.me/" + CP.wa + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
      $(".regalo-form", modal).hidden = true;
      $(".regalo-ok", modal).hidden = false;
      store("cp_regalo_visto", String(Date.now() + 365 * 24 * 3600 * 1000));
    });
  }

  /* ---------- Hero 3D (solo con WebGL y sin reduced-motion) ---------- */
  function webglOK() {
    try {
      var c = d.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }
  var conn = navigator.connection || {};
  if (!reduce && !conn.saveData && webglOK()) {
    var cargar3d = function () {
      var url = new URL("hero3d.js", scriptSrc || d.baseURI).href;
      import(url).then(function (m) {
        return m.iniciar($("#escena3d"), { tapa: CP.tapa });
      }).then(function (ok) {
        if (ok) $(".hero").classList.add("con-3d");
      }).catch(function (e) { /* queda la imagen de respaldo */ if (window.console) console.warn("3D desactivado:", e && e.message); });
    };
    if (d.readyState === "complete") cargar3d(); else window.addEventListener("load", cargar3d);
  }

  /* ---------- Animaciones con GSAP + ScrollTrigger ---------- */
  var gsap = window.gsap, ST = window.ScrollTrigger;
  var contNum = $(".contador-num"), contN2 = $(".contador-n2"), contSem = $(".contador-semana"), anillo = $(".anillo-fill");
  function setDia(n) {
    n = Math.round(n);
    if (contNum) contNum.textContent = n;
    if (contN2) contN2.textContent = n;
    if (anillo) anillo.style.strokeDashoffset = String(100 - (n / 30) * 100);
  }

  if (!gsap || !ST || reduce) {
    // Sin animaciones: el contador muestra el plan completo y las barras quedan dibujadas.
    setDia(30);
    return;
  }
  gsap.registerPlugin(ST);
  d.documentElement.classList.add("js-motion");

  // Títulos de sección: una sola entrada por título, sin repetir efectos en cada tarjeta.
  $$(".sec .titulo").forEach(function (h) {
    gsap.fromTo(h, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: h, start: "top 88%", once: true } });
  });

  // Hero: entrada orquestada del texto.
  gsap.from([".marca", ".hero h1", ".hero-sub", ".hero-cta"], { y: 22, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.09, delay: 0.05 });

  // Barras del ejemplo: crecen al entrar.
  var fills = $$(".barra-fill");
  if (fills.length) gsap.from(fills, { scaleX: 0, duration: 1.1, ease: "power2.out", stagger: 0.18, scrollTrigger: { trigger: ".barras", start: "top 80%", once: true } });

  // Frase lista: se "enciende".
  gsap.from(".frase", { scale: 0.96, opacity: 0, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: ".frase", start: "top 85%", once: true } });

  // Bonos: llegan como hojas sobre la mesa.
  $$(".bono").forEach(function (b, i) {
    gsap.from(b, { y: 40, rotation: i % 2 ? 2.5 : -2.5, opacity: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: b, start: "top 90%", once: true } });
  });

  // Contador del plan: avanza 0 → 7 → 14 → 21 → 30 a medida que pasan las semanas.
  var estado = { n: 0 };
  var semanas = $$(".semana");
  function irA(hasta, nombre) {
    gsap.to(estado, { n: hasta, duration: 1, ease: "power2.out", overwrite: true, onUpdate: function () { setDia(estado.n); } });
    if (contSem && nombre) contSem.textContent = nombre;
  }
  semanas.forEach(function (s, i) {
    ST.create({
      trigger: s, start: "top 62%", end: "bottom 62%",
      onEnter: function () { irA(Number(s.dataset.hasta), s.dataset.semana); },
      onEnterBack: function () { irA(Number(s.dataset.hasta), s.dataset.semana); },
      onLeaveBack: function () {
        if (i === 0) irA(0, semanas[0].dataset.semana);
        else irA(Number(semanas[i - 1].dataset.hasta), semanas[i - 1].dataset.semana);
      }
    });
  });

  // Mockup: leve parallax.
  if ($(".mockup")) gsap.fromTo(".mockup-wrap", { y: 40, rotation: -2 }, { y: -30, rotation: 1, ease: "none", scrollTrigger: { trigger: "#adentro", start: "top bottom", end: "bottom top", scrub: 1 } });

  // Recalcular cuando se abre/cierra una semana o cargan imágenes.
  $$("details").forEach(function (det) { det.addEventListener("toggle", function () { ST.refresh(); }); });
  window.addEventListener("load", function () { ST.refresh(); });
})();
