/* Hero 3D: un celular con el feed infinito se apaga, gira y se convierte en el libro.
   Alrededor vuelven los juguetes. Liviano: sin sombras, geometría simple, pausa fuera de pantalla. */
import * as THREE from "../vendor/three.module.min.js";

const AMARILLO = 0xf2c300, NEGRO = 0x151515, CREMA = 0xfff6dc;

function rectRedondeado(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function uvPlano(geo) {
  geo.computeBoundingBox();
  const b = geo.boundingBox, p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
  }
  uv.needsUpdate = true;
  return geo;
}

/* Pantalla del celular: un feed de videos que no termina. */
function texturaFeed() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = "#101010"; g.fillRect(0, 0, 256, 512);
  const colores = ["#ff5a5f", "#4f8cff", "#21c07a", "#ffb020", "#b56bff", "#ff7ac6", "#2fd4e0", "#ff8a3d"];
  for (let i = 0; i < 4; i++) {
    const y = i * 128 + 8;
    const grd = g.createLinearGradient(0, y, 256, y + 110);
    grd.addColorStop(0, colores[(i * 2) % 8]); grd.addColorStop(1, colores[(i * 2 + 1) % 8]);
    g.fillStyle = grd;
    g.beginPath(); g.roundRect(12, y, 232, 92, 12); g.fill();
    g.fillStyle = "rgba(255,255,255,.92)";
    g.beginPath(); g.moveTo(116, y + 30); g.lineTo(116, y + 62); g.lineTo(144, y + 46); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(12, y + 100, 150, 8);
    g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(12, y + 112, 90, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function texturaBloque(letra, fondo, tinta) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = fondo; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = tinta; g.lineWidth = 10; g.strokeRect(9, 9, 110, 110);
  g.fillStyle = tinta; g.font = "800 76px Bricolage, system-ui, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(letra, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaPelota() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  const franjas = ["#F2C300", "#FFF6DC", "#151515", "#FFF6DC", "#F2C300", "#FFF6DC", "#151515", "#FFF6DC"];
  franjas.forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 32, 0, 32, 128); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function iniciar(canvas, opts) {
  if (!canvas) return false;
  const gsap = window.gsap;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 0, 10);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2620, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(AMARILLO, 1.4);
  rim.position.set(-5, 2, -3); scene.add(rim);

  const tapaTex = await new THREE.TextureLoader().loadAsync(opts.tapa);
  tapaTex.colorSpace = THREE.SRGBColorSpace;
  tapaTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  /* ---- Celular ---- */
  const celu = new THREE.Group();
  const cuerpoGeo = new THREE.ExtrudeGeometry(rectRedondeado(1.5, 3.05, 0.24), { depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 10 });
  cuerpoGeo.center();
  celu.add(new THREE.Mesh(cuerpoGeo, new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.55, roughness: 0.32 })));
  const vidrio = new THREE.Mesh(uvPlano(new THREE.ShapeGeometry(rectRedondeado(1.38, 2.92, 0.18), 10)), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  vidrio.position.z = 0.115; celu.add(vidrio);
  const feed = texturaFeed();
  const pantalla = new THREE.Mesh(uvPlano(new THREE.ShapeGeometry(rectRedondeado(1.3, 2.84, 0.15), 10)), new THREE.MeshBasicMaterial({ map: feed, transparent: true }));
  pantalla.position.z = 0.118; celu.add(pantalla);
  const isla = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 12), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  isla.rotation.z = Math.PI / 2; isla.position.set(0, 1.3, 0.122); celu.add(isla);
  scene.add(celu);

  /* ---- Libro ---- */
  const libro = new THREE.Group();
  const hojas = new THREE.MeshStandardMaterial({ color: 0xf1e7cc, roughness: 0.9 });
  const negro = new THREE.MeshStandardMaterial({ color: NEGRO, roughness: 0.6 });
  const tapaMat = new THREE.MeshStandardMaterial({ map: tapaTex, roughness: 0.55 });
  const lomo = new THREE.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.5 });
  // orden de caras: +x, -x, +y, -y, +z, -z
  libro.add(new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.98, 0.3), [hojas, lomo, hojas, hojas, tapaMat, negro]));
  libro.visible = false;
  scene.add(libro);

  /* ---- El aro de la tapa ---- */
  const aro = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.3, 24, 96), new THREE.MeshStandardMaterial({ color: AMARILLO, roughness: 0.38, metalness: 0.05 }));
  aro.position.set(1.35, 1.25, -2.2);
  aro.rotation.set(0.25, -0.45, 0);
  scene.add(aro);

  /* ---- Juguetes ---- */
  const juguetes = [];
  const caja = new THREE.BoxGeometry(0.62, 0.62, 0.62);
  const mkBloque = (l, f, t) => new THREE.Mesh(caja, new THREE.MeshStandardMaterial({ map: texturaBloque(l, f, t), roughness: 0.7 }));
  const bloqueA = mkBloque("A", "#F2C300", "#151515");
  const bloqueB = mkBloque("B", "#FFF6DC", "#151515");
  const bloqueC = mkBloque("C", "#151515", "#F2C300");
  const pelota = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 18), new THREE.MeshStandardMaterial({ map: texturaPelota(), roughness: 0.45 }));
  const crayon = new THREE.Group();
  const cuerpoCrayon = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.95, 18), new THREE.MeshStandardMaterial({ color: AMARILLO, roughness: 0.6 }));
  const punta = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 18), new THREE.MeshStandardMaterial({ color: 0xd9a900, roughness: 0.6 }));
  punta.position.y = 0.595;
  const banda = new THREE.Mesh(new THREE.CylinderGeometry(0.104, 0.104, 0.18, 18), negro);
  banda.position.y = -0.15;
  crayon.add(cuerpoCrayon, punta, banda);
  const estrella = (() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.16 : 0.36, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    g.center();
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: CREMA, roughness: 0.5 }));
  })();

  const lugares = [
    [bloqueA, -2.15, 1.05, 0.2], [pelota, 2.05, -1.05, 0.6], [bloqueB, -1.95, -1.25, 0.5],
    [crayon, 2.15, 0.55, 0.4], [bloqueC, -0.9, -2.0, -0.6], [estrella, -1.0, 1.95, -0.4],
  ];
  lugares.forEach(([m, x, y, z], i) => {
    m.userData = { x, y, z, fase: i * 1.3, giro: 0.3 + (i % 3) * 0.15 };
    m.position.set(x * 0.2, y * 0.2, z);
    m.scale.setScalar(0.001);
    m.rotation.set(0.4 * i, 0.7 * i, 0.2 * i);
    scene.add(m);
    juguetes.push(m);
  });

  /* ---- Tamaño ---- */
  let escalaJuguetes = 1;
  function ajustar() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    const asp = w / h;
    camera.aspect = asp;
    camera.position.z = asp < 1 ? 8.6 / Math.max(asp, 0.55) * 0.92 : (asp > 1.15 ? 8.4 : 8.8);
    escalaJuguetes = Math.min(1, Math.max(0.7, asp * 0.75));
    aro.position.x = asp < 1.15 ? 0.95 : 1.35;
    aro.scale.setScalar(asp < 1.15 ? 0.88 : 1);
    camera.updateProjectionMatrix();
  }
  ajustar();
  if ("ResizeObserver" in window) new ResizeObserver(ajustar).observe(canvas);
  else window.addEventListener("resize", ajustar);

  /* ---- Secuencia: el celu se apaga y se vuelve libro ---- */
  const estado = { giro: -0.4, aparicion: 0 };
  celu.rotation.set(0.08, -0.4, 0.04);
  libro.rotation.set(0.06, -Math.PI / 2, -0.03);

  function secuencia() {
    if (!gsap) {
      celu.visible = false; libro.visible = true; libro.rotation.y = 0.25; estado.aparicion = 1;
      return;
    }
    const tl = gsap.timeline({ delay: 1.1 });
    tl.to(pantalla.scale, { y: 0.012, duration: 0.28, ease: "power2.in" })
      .to(pantalla.scale, { x: 0.0, duration: 0.2, ease: "power2.in" })
      .to(celu.rotation, { y: Math.PI / 2, duration: 0.45, ease: "power2.in" }, "+=0.25")
      .add(() => { celu.visible = false; libro.visible = true; })
      .fromTo(libro.rotation, { y: -Math.PI / 2 }, { y: 0.28, duration: 0.95, ease: "back.out(1.4)" })
      .fromTo(libro.scale, { x: 0.9, y: 0.9, z: 0.9 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: "power2.out" }, "<")
      .to(estado, { aparicion: 1, duration: 1.1, ease: "back.out(1.6)" }, "<0.1");
  }
  secuencia();

  /* ---- Interacción: puntero y scroll ---- */
  const puntero = { x: 0, y: 0 }, suave = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    puntero.x = (e.clientX / window.innerWidth) * 2 - 1;
    puntero.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let visible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) loop(); }).observe(canvas);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) loop(); });

  const reloj = new THREE.Clock();
  let corriendo = false;
  function loop() {
    if (corriendo) return;
    corriendo = true;
    reloj.getDelta();
    requestAnimationFrame(cuadro);
  }
  function cuadro() {
    if (!visible || document.hidden) { corriendo = false; return; }
    const dt = Math.min(reloj.getDelta(), 0.05);
    const t = reloj.elapsedTime;
    feed.offset.y -= dt * 0.22;

    suave.x += (puntero.x - suave.x) * 0.05;
    suave.y += (puntero.y - suave.y) * 0.05;
    const scroll = Math.min(1, window.scrollY / Math.max(1, window.innerHeight));

    const flot = Math.sin(t * 1.2) * 0.08;
    celu.position.y = flot;
    libro.position.y = flot - scroll * 0.6;
    libro.rotation.x = 0.06 + suave.y * 0.12 + scroll * 0.25;
    if (estado.aparicion > 0.99) libro.rotation.y += ((0.28 + suave.x * 0.35 + scroll * 0.9 + Math.sin(t * 0.5) * 0.08) - libro.rotation.y) * 0.06;

    aro.rotation.z = t * 0.12;
    aro.position.y = 1.25 + Math.sin(t * 0.8) * 0.06;

    const a = estado.aparicion;
    juguetes.forEach((m) => {
      const u = m.userData;
      m.scale.setScalar(Math.max(0.001, a * escalaJuguetes));
      m.position.set(u.x * (0.2 + 0.8 * a) * escalaJuguetes, u.y * (0.2 + 0.8 * a) + Math.sin(t * 1.4 + u.fase) * 0.09, u.z);
      m.rotation.x += dt * u.giro * 0.6;
      m.rotation.y += dt * u.giro;
    });

    renderer.render(scene, camera);
    requestAnimationFrame(cuadro);
  }

  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    document.querySelector(".hero")?.classList.remove("con-3d");
  });

  renderer.render(scene, camera);
  loop();
  return true;
}
