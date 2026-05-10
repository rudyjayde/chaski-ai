/* ============================================================
   index.js — Chaski AI v2.0
   ============================================================
   1. Escena Three.js   — espacio profundo + estrellas + nébula
   2. Animación GSAP    — entrada cinemática de todos los elementos
   3. Parallax mouse    — cámara + corredor reaccionan al cursor
   4. Eventos de UI     — navbar, menú móvil, scroll suave
   5. Contadores        — IntersectionObserver
   6. Tarjetas          — IntersectionObserver
   7. Formulario        — WhatsApp redirect
   ============================================================ */

'use strict';

/* ============================================================
   1. ESCENA THREE.JS — Espacio profundo
   ============================================================ */
let _camera = null; /* Expuesto para parallax */

(function initSpaceScene() {

  if (typeof THREE === 'undefined') return;

  const canvas = document.getElementById('scene');
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x020510, 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 0, 1);
  _camera = camera;

  /* ---- Campo de estrellas ---- */
  const STAR_COUNT = 9000;
  const starPos    = new Float32Array(STAR_COUNT * 3);
  const starColors = new Float32Array(STAR_COUNT * 3);
  const starSizes  = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    const r     = 150 + Math.random() * 600;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    starPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i*3+2] = r * Math.cos(phi);

    const t = Math.random();
    if (t > 0.93) {
      starColors[i*3]=1.0; starColors[i*3+1]=0.85; starColors[i*3+2]=0.4;  /* dorada */
    } else if (t > 0.7) {
      starColors[i*3]=0.6; starColors[i*3+1]=0.85; starColors[i*3+2]=1.0;  /* azul */
    } else {
      starColors[i*3]=1.0; starColors[i*3+1]=1.0; starColors[i*3+2]=1.0;   /* blanca */
    }
    starSizes[i] = 0.15 + Math.random() * 0.55;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos,    3));
  starGeo.setAttribute('color',    new THREE.BufferAttribute(starColors, 3));
  starGeo.setAttribute('size',     new THREE.BufferAttribute(starSizes,  1));

  const starMat = new THREE.PointsMaterial({
    size: 0.35,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ---- Nébulas de color ---- */
  function makeNebula(r, g, b, x, y, z, w, h, rot) {
    const nc = document.createElement('canvas');
    nc.width = nc.height = 512;
    const ctx = nc.getContext('2d');
    const grad = ctx.createRadialGradient(256,256,0,256,256,256);
    grad.addColorStop(0,   `rgba(${r},${g},${b},0.35)`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},0.10)`);
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,512,512);
    const tex = new THREE.CanvasTexture(nc);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.z = rot;
    scene.add(mesh);
    return mesh;
  }

  makeNebula(14, 80,  160, -18, 10, -80, 240, 150, 0.25);  /* azul sky profundo */
  makeNebula(56, 120, 200,  28, -4, -65, 190, 130, -0.18); /* azul cielo */
  makeNebula(30, 50,  140,  -4, -14, -95, 170, 110, 0.45); /* indigo suave */
  makeNebula(0,  140, 200, -35,  5, -50, 120,  80, -0.3);  /* cyan spot */

  /* ---- Red de rutas GPS (plano inferior — perspectiva orbital) ---- */
  (function addRouteNetwork() {
    const COLS = 18, ROWS = 12;
    const W2 = 160, H2 = 100;
    const Y_PLANE = -22;
    const pts = [];
    const nodePositions = [];

    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        const x = -W2/2 + (i / (COLS-1)) * W2 + (Math.random()-0.5) * 6;
        const z = -H2/2 + (j / (ROWS-1)) * H2 + (Math.random()-0.5) * 6 - 30;
        nodePositions.push(new THREE.Vector3(x, Y_PLANE, z));
        pts.push(x, Y_PLANE, z);
      }
    }

    /* Puntos nodo */
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    const nodeMat = new THREE.PointsMaterial({
      size: 0.55, color: 0x00C8FF, transparent: true,
      opacity: 0.55, depthWrite: false,
    });
    scene.add(new THREE.Points(nodeGeo, nodeMat));

    /* Líneas de conexión entre nodos cercanos */
    const lineVerts = [];
    const MAX_EDGE = 18;
    for (let a = 0; a < nodePositions.length; a++) {
      for (let b = a+1; b < nodePositions.length; b++) {
        if (nodePositions[a].distanceTo(nodePositions[b]) < MAX_EDGE) {
          lineVerts.push(
            nodePositions[a].x, nodePositions[a].y, nodePositions[a].z,
            nodePositions[b].x, nodePositions[b].y, nodePositions[b].z
          );
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVerts), 3));
    scene.add(new THREE.LineSegments(lineGeo,
      new THREE.LineBasicMaterial({ color: 0x004488, transparent: true, opacity: 0.35 })
    ));

    /* Pulsos animados: pequeñas esferas que viajan por las rutas */
    const pulseCount = 14;
    const pulses = [];
    for (let i = 0; i < pulseCount; i++) {
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00FFB0, transparent: true, opacity: 0.9 })
      );
      const idx = Math.floor(Math.random() * nodePositions.length);
      sphere.position.copy(nodePositions[idx]);
      scene.add(sphere);
      pulses.push({ mesh: sphere, t: Math.random(), speed: 0.3 + Math.random() * 0.5,
        a: idx, b: (idx + 1 + Math.floor(Math.random() * 3)) % nodePositions.length });
    }

    /* Actualizar pulsos en el loop */
    window._updatePulses = function() {
      for (const p of pulses) {
        p.t += 0.006 * p.speed;
        if (p.t >= 1) {
          p.t = 0;
          p.a = p.b;
          p.b = Math.floor(Math.random() * nodePositions.length);
        }
        p.mesh.position.lerpVectors(nodePositions[p.a], nodePositions[p.b], p.t);
      }
    };
  })();

  /* ---- Bucle ---- */
  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.00018;
    stars.rotation.y = t * 0.3;
    stars.rotation.x = t * 0.1;
    if (window._updatePulses) window._updatePulses();
    renderer.render(scene, camera);
  }
  animate();

  /* ---- Resize ---- */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }, { passive: true });

})();


/* ============================================================
   2. ANIMACIÓN GSAP — Secuencia cinematográfica
   Inspirada en el estilo de Richard Mattka:
   barras se cierran → escena aparece → barras se abren
   → elementos entran con coreografía precisa
   ============================================================ */
(function initGSAPIntro() {

  if (typeof gsap === 'undefined') {
    document.querySelectorAll(
      '#heroBadge,#heroTitle,#htAi,#heroSub,#btnEnter,#earthCanvas,#scrollIndicator'
    ).forEach(el => { if (el) { el.style.opacity='1'; el.style.transform='none'; } });
    return;
  }

  function run() {

    /* Estado inicial */
    gsap.set('#earthCanvas',       { x: 60, opacity: 0 });
    gsap.set('#heroBadge',         { y: 18,   opacity: 0 });
    gsap.set('#heroTitle',         { y: 30,   opacity: 0 });
    gsap.set('#htAi',              { opacity: 1 });
    gsap.set('#heroSub',           { y: 20,   opacity: 0 });
    gsap.set('#btnEnter',          { y: 18,   opacity: 0 });
    gsap.set('#scrollIndicator',   { opacity: 0 });

    const tl = gsap.timeline();

    /* Globo terrestre */
    tl.to('#earthCanvas', { x: 0, opacity: 1, duration: 1.8, ease: 'expo.out' }, 0.2)

    /* Badge */
    .to('#heroBadge', { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.4)

    /* Título */
    .to('#heroTitle', { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }, 0.65)

    /* Subtítulo */
    .to('#heroSub', { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' }, 0.95)

    /* Botón */
    .to('#btnEnter', { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.6)' }, 1.2)

    /* Scroll indicator */
    .to('#scrollIndicator', { opacity: 1, duration: 0.5 }, 1.5);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();


/* ============================================================
   3. PARALLAX CON EL MOUSE
   La cámara Three.js y el globo se desplazan sutilmente
   siguiendo el cursor — da sensación de profundidad.
   ============================================================ */
(function initParallax() {

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (isMobile) return;

  let mx = 0, my = 0; /* -1 a 1 */

  window.addEventListener('mousemove', (e) => {
    mx = (e.clientX / window.innerWidth  - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function tick() {
    requestAnimationFrame(tick);

    /* Mover cámara Three.js background (profundidad espacial) */
    if (_camera && typeof gsap !== 'undefined') {
      gsap.to(_camera.position, {
        x: mx * 0.8,
        y: -my * 0.5,
        duration: 2.5,
        ease: 'power1.out',
        overwrite: 'auto',
      });
    }

    /* Leve traslación del globo en dirección opuesta */
    if (typeof gsap !== 'undefined') {
      gsap.to('#earthCanvas', {
        x: mx * -12,
        y: my * -7,
        duration: 2.2,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    }
  }

  tick();

})();


/* ============================================================
   3b. GLOBO TERRESTRE 3D — Three.js en canvas propio
   Diseño inspirado en Earth3D del design bundle:
   wireframe azul + puntos de continentes + arcos amber +
   marcador Puno + zoom al hacer scroll
   ============================================================ */
(function initEarthScene() {

  if (typeof THREE === 'undefined') return;
  const canvas = document.getElementById('earthCanvas');
  if (!canvas) return;

  const SIZE = 900; /* resolución interna del canvas */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(SIZE, SIZE);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0.3, 5.2);
  camera.lookAt(0, 0, 0);

  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const R = 1.5; /* radio del globo */

  /* ── 1. Esfera base oscura ── */
  earthGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 64),
    new THREE.MeshStandardMaterial({ color: 0x020C20, roughness: 0.85, metalness: 0.1 })
  ));

  /* ── 2. Cuadrícula lat/lng ── */
  const gridMat = new THREE.LineBasicMaterial({ color: 0x1D9BD1, transparent: true, opacity: 0.28 });

  for (let lat = -80; lat <= 80; lat += 20) {
    const pts = [];
    const r2 = Math.cos(lat * Math.PI / 180) * (R + 0.003);
    const y  = Math.sin(lat * Math.PI / 180) * (R + 0.003);
    for (let lng = 0; lng <= 361; lng += 3)
      pts.push(new THREE.Vector3(r2 * Math.cos(lng * Math.PI / 180), y, r2 * Math.sin(lng * Math.PI / 180)));
    earthGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  }

  for (let lng = 0; lng < 360; lng += 30) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 3) {
      const r2 = Math.cos(lat * Math.PI / 180) * (R + 0.003);
      const y  = Math.sin(lat * Math.PI / 180) * (R + 0.003);
      pts.push(new THREE.Vector3(r2 * Math.cos(lng * Math.PI / 180), y, r2 * Math.sin(lng * Math.PI / 180)));
    }
    earthGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
  }

  /* ── 3. Nube de puntos — continentes ── */
  function isLand(lat, lng) {
    while (lng > 180)  lng -= 360;
    while (lng < -180) lng += 360;
    const shapes = [
      [10,  22,  40, 32],   // Africa
      [52,  12,  24, 34],   // Europe
      [60,  55,  28, 42],   // Russia/Central Asia
      [28,  90,  30, 38],   // South/SE Asia
      [35, 118,  20, 22],   // East Asia coast
      [-25, 134,  20, 24],  // Australia
      [45, -98,  24, 40],   // North America
      [-14, -56,  30, 18],  // South America
      [70,  -40,  14, 24],  // Greenland
    ];
    for (const [clat, clng, rlat, rlng] of shapes) {
      let dl = lng - clng;
      if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
      if ((lat - clat) ** 2 / rlat ** 2 + dl ** 2 / rlng ** 2 < 1) return true;
    }
    return false;
  }

  function ll2v(lat, lng, r) {
    const phi   = (90 - lat)  * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  const dotPos = [];
  let tries = 0;
  while (dotPos.length / 3 < 3500 && tries < 80000) {
    tries++;
    const lat = (Math.random() - 0.5) * 168;
    const lng = (Math.random() - 0.5) * 360;
    if (!isLand(lat, lng)) continue;
    const v = ll2v(lat, lng, R + 0.006);
    dotPos.push(v.x, v.y, v.z);
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dotPos), 3));
  earthGroup.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({
    color: 0x1D9BD1, size: 0.017, sizeAttenuation: true, transparent: true, opacity: 0.9
  })));

  /* ── 4. Marcadores ── */
  const punoPos = ll2v(-15.5, -70.0, R + 0.02);  // Puno (TipCar)
  const limaPos = ll2v(-12.1, -77.1, R + 0.02);  // Lima

  // Puno — oro (hub de operaciones)
  const punoMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.030, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xFBBF24 })
  );
  punoMesh.position.copy(punoPos);
  earthGroup.add(punoMesh);

  // Lima — azul
  const limaMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x38BDF8 })
  );
  limaMesh.position.copy(limaPos);
  earthGroup.add(limaMesh);

  // Anillo de pulso Puno
  const ringM = new THREE.Mesh(
    new THREE.RingGeometry(0.046, 0.062, 48),
    new THREE.MeshBasicMaterial({ color: 0xFBBF24, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
  );
  ringM.position.copy(punoPos);
  ringM.lookAt(0, 0, 0);
  earthGroup.add(ringM);

  /* ── 5. Arcos de ciudades del mundo → Puno ── */
  const cities = [
    { lat: 40.7,  lng: -74.0 },
    { lat: 51.5,  lng:  -0.1 },
    { lat: 35.7,  lng: 139.7 },
    { lat: -33.9, lng: 151.2 },
    { lat: -23.5, lng: -46.6 },
  ];

  const arcMat = new THREE.LineBasicMaterial({ color: 0xFBBF24, transparent: true, opacity: 0.30 });
  cities.forEach(city => {
    const s = ll2v(city.lat, city.lng, R + 0.01);
    const e = punoPos.clone().normalize().multiplyScalar(R + 0.01);
    const mid = s.clone().add(e).multiplyScalar(0.5).normalize().multiplyScalar(2.35);
    const pts = new THREE.QuadraticBezierCurve3(s, mid, e).getPoints(64);
    earthGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat));
  });

  /* ── 6. Atmósfera (anillo exterior + esfera suave) ── */
  earthGroup.add(new THREE.Mesh(
    new THREE.RingGeometry(R + 0.06, R + 0.10, 128),
    new THREE.MeshBasicMaterial({ color: 0x1D9BD1, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  ));
  earthGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(R + 0.08, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0x1D9BD1, transparent: true, opacity: 0.05, side: THREE.BackSide })
  ));

  /* ── 7. Iluminación ── */
  scene.add(new THREE.AmbientLight(0x1a3A6E, 0.7));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(4, 3, 5);
  scene.add(dirLight);
  const punoLight = new THREE.PointLight(0xFBBF24, 0.7, 6);
  punoLight.position.copy(punoPos.clone().multiplyScalar(2.8));
  scene.add(punoLight);

  /* ── 8. Scroll zoom ── */
  let scrollProg = 0;
  window.addEventListener('scroll', () => {
    const hero = document.getElementById('hero');
    if (!hero) return;
    scrollProg = Math.min(window.scrollY / (hero.clientHeight * 0.75), 1);
  }, { passive: true });

  /* ── 9. Loop ── */
  let ringScale = 1, ringDir = 1;
  function animate() {
    requestAnimationFrame(animate);
    earthGroup.rotation.y += 0.0016;

    /* Pulso del anillo de Puno */
    ringScale += 0.008 * ringDir;
    if (ringScale > 1.35) ringDir = -1;
    if (ringScale < 1.0)  ringDir =  1;
    ringM.scale.setScalar(ringScale);
    ringM.material.opacity = 0.65 * (1.5 - ringScale);

    /* Zoom al hacer scroll */
    const targetZ = 5.2 - scrollProg * 1.6;
    camera.position.z += (targetZ - camera.position.z) * 0.045;

    renderer.render(scene, camera);
  }
  animate();

  /* ── 10. Resize ── */
  window.addEventListener('resize', () => {
    const el = document.getElementById('earthCanvas');
    if (!el) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }, { passive: true });

})();


/* ============================================================
   3d. TICKER HUD — actualiza latencia y velocidad en tiempo real (decorativo)
   ============================================================ */
(function initHudTicker() {
  function rnd(min, max) { return (min + Math.random() * (max-min)).toFixed(0); }
  setInterval(() => {
    const lat = document.querySelector('.hud-status .hs-val:last-child');
    if (lat) lat.textContent = rnd(8, 24) + ' ms';
  }, 2200);
})();


/* ============================================================
   4. EVENTOS DE INTERFAZ
   ============================================================ */

(function initUI() {

  /* ---- Navbar: fondo al hacer scroll ---- */
  const navbar    = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');

  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  }

  /* ---- Menú móvil ---- */
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.classList.toggle('active', open);
    });

    /* Cerrar al hacer clic en un link */
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.classList.remove('active');
      });
    });
  }

  /* ---- Scroll suave para anclas internas ---- */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

})();


/* ============================================================
   5. CONTADORES ANIMADOS
   ============================================================ */

(function initCounters() {

  /**
   * Anima un elemento de 0 al valor indicado en data-target.
   * @param {HTMLElement} el       - Elemento a animar
   * @param {number}      target   - Valor final
   * @param {number}      duration - Duración en ms
   */
  function animateCounter(el, target, duration = 1800) {
    const start = performance.now();
    function step(now) {
      const progress = Math.min((now - start) / duration, 1);
      /* Ease-out cuadrático */
      const eased = 1 - Math.pow(1 - progress, 2);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Observar los contenedores con [data-target] */
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      entry.target.querySelectorAll('[data-target]').forEach(el => {
        const target = parseInt(el.dataset.target, 10);
        if (!isNaN(target)) animateCounter(el, target);
      });

      /* Añadir clase de visibilidad para animación CSS */
      entry.target.querySelectorAll('.stat-card').forEach((card, i) => {
        setTimeout(() => card.classList.add('in-view'), i * 120);
      });

      counterObserver.unobserve(entry.target);
    });
  }, { threshold: 0.25 });

  const statsSection = document.querySelector('.section-stats');
  if (statsSection) counterObserver.observe(statsSection);

})();


/* ============================================================
   6. ANIMACIÓN DE ENTRADA DE TARJETAS
   ============================================================ */

(function initCardAnimations() {

  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const delay = parseInt(entry.target.dataset.animDelay || '0', 10);
      setTimeout(() => {
        entry.target.classList.add('in-view');
      }, delay);

      cardObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  /* Tarjetas de servicio */
  document.querySelectorAll('.svc-card').forEach(card => {
    cardObserver.observe(card);
  });

})();


/* ============================================================
   7. FORMULARIO DE CONTACTO → WHATSAPP
   ============================================================ */

(function initContactForm() {

  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const inputs = form.querySelectorAll('input, select, textarea');
    const labels = ['Nombre', 'Empresa', 'Contacto', 'Flota', 'Mensaje'];

    let msg = '🚀 *Solicitud de información — Chaski AI*\n\n';
    inputs.forEach((input, i) => {
      if (input.value && input.value.trim()) {
        msg += `*${labels[i] || 'Dato'}:* ${input.value.trim()}\n`;
      }
    });

    const phone = '51900000000'; /* Cambiar por número real */
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,
      '_blank'
    );
  });

})();
