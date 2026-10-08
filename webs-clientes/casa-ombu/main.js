(function () {
  "use strict";

  // Datos del negocio (cambiar por los reales del cliente)
  var BRAND = {
    name: "Casa Ombú",
    whatsapp: "5491100000000", // formato internacional sin + ni espacios
    address: "Gurruchaga 1800, Palermo Soho, CABA",
    open: 10, close: 20, closedDays: [0], // 0 = domingo
    durations: { "Masaje relajante": 60, "Masaje descontracturante": 60, "Piedras calientes": 75, "Facial hidratante": 50, "Ritual Ombú": 100, "Masaje en pareja": 60 }
  };

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }
  function waLink(text) { return "https://wa.me/" + BRAND.whatsapp + "?text=" + encodeURIComponent(text); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function initNav() {
    var nav = $("[data-nav]");
    var on = function () { nav.classList.toggle("is-solid", window.scrollY > 30); };
    on(); window.addEventListener("scroll", on, { passive: true });
  }

  function initReveals() {
    var els = $$(".reveal");
    var showAll = function () { els.forEach(function (el) { el.classList.add("is-in"); }); };
    if (!("IntersectionObserver" in window)) return showAll();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.05, rootMargin: "0px 0px -40px 0px" });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(showAll, 4000); // red de seguridad: nunca contenido invisible
  }

  function initWhatsApp() {
    $$("[data-wa]").forEach(function (a) { a.href = waLink("Hola " + BRAND.name + ", quería hacer una consulta."); });
  }

  // ---------- Reservas ----------
  var state = { dia: "", hora: "" };

  function initBooking() {
    var form = $("[data-booking]"); if (!form) return;
    var daysBox = $("[data-days]"), slotsBox = $("[data-slots]");
    var names = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    var d = new Date();
    for (var i = 0, n = 0; n < 12 && i < 20; i++) {
      var day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      if (BRAND.closedDays.indexOf(day.getDay()) > -1) continue;
      if (i === 0 && d.getHours() >= BRAND.close - 1) continue;
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.day = ymd(day); b.setAttribute("aria-pressed", "false");
      b.innerHTML = (i === 0 ? "Hoy" : names[day.getDay()]) + "<b>" + day.getDate() + "</b>";
      daysBox.appendChild(b); n++;
    }
    daysBox.addEventListener("click", function (e) {
      var b = e.target.closest(".chip"); if (!b) return;
      $$(".chip", daysBox).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      state.dia = b.dataset.day; state.hora = ""; renderSlots();
    });
    function renderSlots() {
      slotsBox.innerHTML = "";
      var now = new Date(), today = ymd(now);
      for (var h = BRAND.open; h < BRAND.close; h++) {
        var t = pad(h) + ":00", s = document.createElement("button");
        s.type = "button"; s.className = "chip"; s.textContent = t; s.dataset.hour = t; s.setAttribute("aria-pressed", "false");
        if (state.dia === today && h <= now.getHours()) s.disabled = true;
        slotsBox.appendChild(s);
      }
    }
    slotsBox.addEventListener("click", function (e) {
      var s = e.target.closest(".chip"); if (!s || s.disabled) return;
      $$(".chip", slotsBox).forEach(function (x) { x.setAttribute("aria-pressed", String(x === s)); });
      state.hora = s.dataset.hour;
    });

    // Botones "Reservar" de cada servicio: preseleccionan el servicio
    $$("[data-book]").forEach(function (a) {
      a.addEventListener("click", function () {
        var card = a.closest("[data-service]");
        if (card) form.servicio.value = card.dataset.service;
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = $("[data-error]");
      var data = { tipo: "reserva", servicio: form.servicio.value, dia: state.dia, hora: state.hora,
        nombre: form.nombre.value.trim(), telefono: form.telefono.value.trim(), nota: form.nota.value.trim() };
      if (!data.dia) return (err.textContent = "Elegí un día.");
      if (!data.hora) return (err.textContent = "Elegí un horario.");
      if (!data.nombre) return (err.textContent = "Contanos tu nombre.");
      if (data.telefono.replace(/\D/g, "").length < 8) return (err.textContent = "Revisá tu WhatsApp, parece incompleto.");
      err.textContent = "";
      var btn = form.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "Enviando…";
      // Se guarda en el panel del negocio; si el servidor no responde, igual seguimos por WhatsApp
      fetch("reserva.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .catch(function () {}).then(function () { showDone(data); });
    });
  }

  function niceDate(dia) {
    var p = dia.split("-"), dt = new Date(+p[0], p[1] - 1, +p[2]);
    return dt.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  }

  function showDone(r) {
    var form = $("[data-booking]"), done = $("[data-done]");
    var when = niceDate(r.dia) + " a las " + r.hora + " h";
    $("[data-done-title]").textContent = r.servicio + ", " + when + ".";
    $("[data-wa-confirm]").href = waLink("Hola! Soy " + r.nombre + ". Reservé desde la web: " + r.servicio + " el " + when + "." + (r.nota ? " Nota: " + r.nota : "") + " ¿Me confirman?");
    $("[data-ics]").onclick = function () { downloadIcs(r); };
    form.hidden = true; done.hidden = false;
    done.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Archivo de calendario con recordatorios (1 día y 2 horas antes)
  function downloadIcs(r) {
    var p = r.dia.split("-"), h = r.hora.split(":");
    var start = new Date(+p[0], p[1] - 1, +p[2], +h[0], +h[1]);
    var end = new Date(start.getTime() + (BRAND.durations[r.servicio] || 60) * 60000);
    var f = function (d) { return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"; };
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Casa Ombu//Reservas//ES", "BEGIN:VEVENT",
      "UID:" + Date.now() + "@casaombu", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(start), "DTEND:" + f(end),
      "SUMMARY:" + r.servicio + " · " + BRAND.name, "LOCATION:" + BRAND.address,
      "DESCRIPTION:Llegá 10 minutos antes. Cambios sin cargo hasta 12 h antes por WhatsApp.",
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Mañana tenés tu turno en " + BRAND.name, "END:VALARM",
      "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:En 2 horas: " + r.servicio, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "turno-casa-ombu.ics"; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- Chat con Luz (IA) ----------
  // Respuestas de respaldo si la IA todavía no está configurada o no responde.
  var LOCAL = [
    [/(convien|elij|recomend|cual|cuál)/i, "Para estrés y dormir mejor, el relajante ($45.000). Para contracturas de cuello y espalda, el descontracturante ($52.000). Para regalar o darte un gusto, el Ritual Ombú ($85.000). ¿Querés reservar? Bajá a «Reservar» y elegí día y horario."],
    [/(ritual)/i, "El Ritual Ombú dura 100 minutos (masaje relajante + piedras calientes + facial express) y sale $85.000. También existe como gift card."],
    [/(precio|cuanto|cuánto|sale|cuesta|valor)/i, "Relajante $45.000 · Descontracturante $52.000 · Piedras calientes $60.000 · Facial $40.000 · Ritual Ombú $85.000 · En pareja $95.000 (las dos personas)."],
    [/(horario|hora|abren|abierto|domingo)/i, "Atendemos de lunes a sábado de 10 a 20 h. Los domingos está cerrado."],
    [/(donde|dónde|direcci|ubica|llego|subte)/i, "Estamos en Gurruchaga 1800, Palermo Soho, a 6 cuadras de Plaza Italia (Línea D)."],
    [/(pago|tarjeta|mercado|transfer|efectivo)/i, "Aceptamos efectivo, transferencia, Mercado Pago y tarjetas."],
    [/(cancel|cambi|reprogram)/i, "Podés cancelar o cambiar sin cargo hasta 12 horas antes, por WhatsApp."],
    [/(embaraz)/i, "Sí, atendemos embarazadas desde el segundo trimestre con masaje adaptado. Avisanos en la nota al reservar."],
    [/(gift|regal)/i, "¡Sí! Tenemos gift cards de cualquier servicio. Pedila por WhatsApp y te la mandamos lista para regalar."],
    [/(reserv|turno)/i, "Reservás en un minuto en la sección «Reservar»: elegís servicio, día y horario, y te confirmamos por WhatsApp."]
  ];
  function localAnswer(q) {
    for (var i = 0; i < LOCAL.length; i++) if (LOCAL[i][0].test(q)) return LOCAL[i][1];
    return "Buena pregunta. Para eso mejor escribinos por WhatsApp (botón verde) y te respondemos enseguida.";
  }

  function initChat() {
    var chat = $("[data-chat]"), log = $("[data-chat-log]"), form = $("[data-chat-form]"), bubble = $(".chat-bubble");
    var history = [];
    function open() { chat.hidden = false; bubble.hidden = true; form.q.focus(); }
    function close() { chat.hidden = true; bubble.hidden = false; }
    $$("[data-open-chat]").forEach(function (b) { b.addEventListener("click", open); });
    $("[data-close-chat]").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !chat.hidden) close(); });

    function add(text, who) {
      var p = document.createElement("p"); p.className = "msg " + who; p.textContent = text;
      log.appendChild(p); log.scrollTop = log.scrollHeight; return p;
    }
    function ask(q) {
      q = q.trim(); if (!q) return;
      add(q, "me"); $("[data-sugs]").hidden = true;
      var t = add("Luz está escribiendo…", "bot typing");
      fetch("asistente-ia.php", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history: history.slice(-8) }) })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (data) {
          var reply = data && data.reply;
          // Si la IA aún no tiene clave, usamos las respuestas de respaldo
          if (!reply || /configurando/.test(reply)) reply = localAnswer(q);
          t.remove(); add(reply, "bot");
          history.push({ role: "user", text: q }, { role: "model", text: reply });
        });
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); ask(form.q.value); form.q.value = ""; });
    $$("[data-sugs] button").forEach(function (b) { b.addEventListener("click", function () { ask(b.textContent); }); });
  }

  function boot() {
    document.documentElement.classList.add("js");
    safe(initNav, "nav");
    safe(initReveals, "reveals");
    safe(initWhatsApp, "whatsapp");
    safe(initBooking, "booking");
    safe(initChat, "chat");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
