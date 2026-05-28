const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clampDpr = () => Math.min(window.devicePixelRatio || 1, 2);

function sizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = clampDpr();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

const pointer = {
  x: 0,
  y: 0,
  tx: 0,
  ty: 0,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderPublications() {
  const list = document.getElementById("publication-list");
  const publications = window.LEGACY_PUBLICATIONS || [];
  if (!list || !publications.length) return;

  list.innerHTML = publications
    .map((publication) => {
      const supplementalLinks = (publication.links || []).filter((link) => {
        const label = String(link.label || "").toLowerCase();
        if (label === "paper" || label === "arxiv") return false;
        return link.href !== publication.titleUrl;
      });
      const links = supplementalLinks
        .map(
          (link) =>
            `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`,
        )
        .join("");
      const title = publication.titleUrl
        ? `<a href="${escapeHtml(publication.titleUrl)}">${escapeHtml(publication.title)}</a>`
        : escapeHtml(publication.title);
      const abstract = publication.abstract
        ? `<details class="paper-detail"><summary>Abstract</summary><p>${escapeHtml(publication.abstract)}</p></details>`
        : "";
      const bibtex = publication.bibtex
        ? `<details class="paper-detail"><summary>BibTeX</summary><pre>${escapeHtml(publication.bibtex)}</pre></details>`
        : "";
      const classes = publication.representative
        ? "publication-card representative reveal"
        : "publication-card reveal";

      return `
        <article class="${classes}" id="pub-${escapeHtml(publication.id)}">
          <p class="paper-year">${escapeHtml(publication.year || "Publication")}</p>
          <h3>${title}</h3>
          <p class="paper-authors">${escapeHtml(publication.authors)}</p>
          <p class="paper-venue">${escapeHtml(publication.venue)}</p>
          ${links ? `<div class="paper-links">${links}</div>` : ""}
          ${abstract}
          ${bibtex}
        </article>
      `;
    })
    .join("");

  list.querySelectorAll('a[href^="http"]').forEach((anchor) => {
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  });
}

function installCursor() {
  const cursor = document.querySelector(".cursor");
  const dot = document.querySelector(".cursor-dot");
  if (!cursor || !dot || !window.matchMedia("(pointer: fine)").matches) return;

  window.addEventListener("mousemove", (event) => {
    document.documentElement.classList.add("cursor-active");
    pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (event.clientY / window.innerHeight) * 2 - 1;
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    dot.style.left = `${event.clientX}px`;
    dot.style.top = `${event.clientY}px`;
  });

  document.querySelectorAll("a").forEach((link) => {
    link.addEventListener("mouseenter", () => {
      cursor.style.transform = "scale(1.22)";
    });
    link.addEventListener("mouseleave", () => {
      cursor.style.transform = "scale(1)";
    });
  });
}

function installReveal() {
  const revealItems = Array.from(document.querySelectorAll(".reveal"));
  if (!revealItems.length) return;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
  );

  revealItems.forEach((item) => observer.observe(item));
}

function installSectionFocus() {
  const sections = Array.from(document.querySelectorAll("main > section[id]"));
  if (!sections.length) return;

  sections.forEach((section) => section.classList.add("scroll-focus"));

  if (reduceMotion || !("IntersectionObserver" in window)) {
    sections.forEach((section) => section.classList.add("section-in-focus"));
    return;
  }

  const visibility = new Map(sections.map((section) => [section, 0]));
  let rafId = 0;

  function updateFocus() {
    rafId = 0;
    let active = sections[0];
    let bestRatio = -1;

    sections.forEach((section) => {
      const ratio = visibility.get(section) || 0;
      if (ratio > bestRatio) {
        active = section;
        bestRatio = ratio;
      }
    });

    sections.forEach((section) => {
      section.classList.toggle("section-in-focus", section === active && bestRatio > 0.04);
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => visibility.set(entry.target, entry.intersectionRatio));
      if (!rafId) rafId = requestAnimationFrame(updateFocus);
    },
    {
      rootMargin: "-18% 0px -30% 0px",
      threshold: [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
    },
  );

  sections.forEach((section) => observer.observe(section));
}

function createParticles(count) {
  return Array.from({ length: count }, (_, index) => {
    const layer = index % 3;
    return {
      x: Math.random(),
      y: Math.random(),
      z: 0.35 + layer * 0.28,
      r: 0.55 + Math.random() * 1.35,
      drift: 0.08 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
    };
  });
}

function drawAmbient(canvas, particles, time) {
  const { ctx, width, height } = sizeCanvas(canvas);
  ctx.clearRect(0, 0, width, height);

  pointer.x += (pointer.tx - pointer.x) * 0.025;
  pointer.y += (pointer.ty - pointer.y) * 0.025;

  const centerX = width * (0.5 + pointer.x * 0.025);
  const centerY = height * (0.5 - pointer.y * 0.025);
  const radius = Math.min(width, height) * 0.44;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(time * 0.000025 + pointer.x * 0.03);
  ctx.strokeStyle = "rgba(214, 150, 116, 0.055)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.ellipse(0, 0, radius + i * 34, radius * 0.38 + i * 12, i * 0.21, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const projected = particles.map((particle) => {
    const angle = particle.phase + time * 0.00004 * particle.drift;
    const x = (particle.x - 0.5) * width * 1.12 + Math.cos(angle) * 12 * particle.z + centerX;
    const y = (particle.y - 0.5) * height * 1.12 + Math.sin(angle * 1.3) * 10 * particle.z + centerY;
    return { x, y, r: particle.r, z: particle.z };
  });

  projected.forEach((particle, index) => {
    ctx.fillStyle = index % 5 === 0 ? "rgba(143, 199, 176, 0.55)" : "rgba(214, 150, 116, 0.48)";
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r * particle.z, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = "rgba(255, 248, 234, 0.04)";
  projected.forEach((particle, index) => {
    for (let next = index + 1; next < Math.min(index + 9, projected.length); next += 1) {
      const other = projected[next];
      const dx = particle.x - other.x;
      const dy = particle.y - other.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 86) continue;
      ctx.globalAlpha = Math.max(0, 1 - distance / 86) * 0.55;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(other.x, other.y);
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
}

function drawAboutVisual(canvas, time = 0) {
  const { ctx, width, height } = sizeCanvas(canvas);
  ctx.clearRect(0, 0, width, height);

  const cell = Math.max(18, width / 16);
  const palette = ["#1b2a33", "#183f37", "#28333c", "#5a4439", "#13252b"];
  for (let y = 0; y < height + cell; y += cell) {
    for (let x = 0; x < width + cell; x += cell) {
      const signal = Math.sin(x * 0.045 + time * 0.0005) + Math.cos(y * 0.055 - time * 0.00035);
      const idx = Math.abs(Math.floor(signal * 10 + x + y)) % palette.length;
      ctx.fillStyle = palette[idx];
      ctx.globalAlpha = 0.58 + Math.abs(signal) * 0.16;
      ctx.fillRect(x, y, cell + 1, cell + 1);
    }
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(255, 248, 234, 0.18)";
  ctx.lineWidth = 1;
  for (let y = height * 0.12; y < height * 0.9; y += height * 0.09) {
    ctx.beginPath();
    for (let x = width * 0.08; x <= width * 0.92; x += 12) {
      const wave = Math.sin(x * 0.025 + y * 0.02 + time * 0.0009) * 10;
      if (x === width * 0.08) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  const path = [
    [0.16, 0.72],
    [0.28, 0.58],
    [0.42, 0.62],
    [0.58, 0.4],
    [0.74, 0.48],
    [0.86, 0.31],
  ];

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#d69674";
  ctx.beginPath();
  path.forEach(([px, py], index) => {
    const x = px * width;
    const y = py * height + Math.sin(time * 0.001 + index) * 4;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  path.forEach(([px, py], index) => {
    const x = px * width;
    const y = py * height + Math.sin(time * 0.001 + index) * 4;
    ctx.fillStyle = index === path.length - 1 ? "#8fc7b0" : "#f4f1ea";
    ctx.beginPath();
    ctx.arc(x, y, index === path.length - 1 ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = "rgba(156, 183, 217, 0.68)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(width * 0.58, height * 0.34, width * 0.2, height * 0.14);
  ctx.strokeRect(width * 0.2, height * 0.62, width * 0.18, height * 0.12);
}

function installCanvases() {
  const ambient = document.getElementById("ambient-canvas");
  const about = document.getElementById("about-visual");
  const particles = createParticles(window.innerWidth < 700 ? 95 : 150);

  function render(time = 0) {
    if (ambient) drawAmbient(ambient, particles, time);
    if (about) drawAboutVisual(about, time);
    if (!reduceMotion) requestAnimationFrame(render);
  }

  render();
  if (reduceMotion) {
    window.addEventListener("resize", () => render(0));
  }
}

renderPublications();
installCursor();
installReveal();
installSectionFocus();
installCanvases();
