const grid = document.getElementById("projectsGrid");
const count = document.getElementById("projectCount");
const year = document.getElementById("year");
const projectsEmpty = document.getElementById("projectsEmpty");

const siteName = document.getElementById("siteName");
const siteTagline = document.getElementById("siteTagline");
const heroLead = document.getElementById("heroLead");
const githubLink = document.getElementById("githubLink");
const heroGithub = document.getElementById("heroGithub");
const heroCta = document.getElementById("heroCta");
const heroSpotlight = document.getElementById("heroSpotlight");
const spotlightTitle = document.getElementById("spotlightTitle");
const spotlightDesc = document.getElementById("spotlightDesc");
const spotlightLink = document.getElementById("spotlightLink");

year.textContent = String(new Date().getFullYear());

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const child of children) {
    if (typeof child === "string") node.appendChild(document.createTextNode(child));
    else if (child) node.appendChild(child);
  }
  return node;
}

function statusLabel(status) {
  const s = String(status ?? "project").toLowerCase();
  if (s === "live") return "Live";
  if (s === "wip" || s === "beta") return "In progress";
  if (s === "archived") return "Archived";
  return status ? String(status) : "Project";
}

function statusClass(status) {
  const s = String(status ?? "project").toLowerCase();
  if (s === "live") return "status status-live";
  if (s === "wip" || s === "beta") return "status status-wip";
  if (s === "archived") return "status status-archived";
  return "status";
}

function projectCard(p) {
  const tags = el(
    "div",
    { class: "tags" },
    (p.tags ?? []).slice(0, 8).map((t) => el("span", { class: "tag" }, [t])),
  );

  const status = el("span", { class: statusClass(p.status) }, [statusLabel(p.status)]);

  const meta = [];
  if (p.year) meta.push(el("span", { class: "card-year" }, [String(p.year)]));

  return el(
    "a",
    {
      class: `card${p.featured ? " card-featured" : ""}`,
      href: p.href ?? "#",
      "data-id": p.id ?? "",
      role: "listitem",
    },
    [
      el("div", { class: "card-title" }, [
        el("h3", { class: "card-name" }, [p.title ?? "Untitled"]),
        status,
      ]),
      el("p", { class: "desc" }, [p.description ?? ""]),
      tags,
      el("div", { class: "card-footer" }, [
        el("div", { class: "card-meta" }, meta),
        el("span", { class: "card-cta" }, ["Open demo", el("span", { class: "card-arrow", "aria-hidden": "true" }, ["→"])]),
      ]),
    ],
  );
}

function pickFeatured(projects) {
  return projects.find((p) => p.featured) ?? projects.find((p) => p.status === "live") ?? projects[0];
}

function applySite(site) {
  if (!site) return;
  if (site.name) {
    siteName.textContent = site.name;
    document.title = site.name;
  }
  if (site.tagline) siteTagline.textContent = site.tagline;
  if (site.description) heroLead.textContent = site.description;
  if (site.github) {
    githubLink.href = site.github;
    heroGithub.href = site.github;
  }
}

function applyFeatured(project) {
  if (!project?.href) {
    heroSpotlight.hidden = true;
    return;
  }
  heroSpotlight.hidden = false;
  spotlightTitle.textContent = project.title ?? "Featured project";
  spotlightDesc.textContent = project.description ?? "";
  spotlightLink.href = project.href;
  heroCta.href = project.href;
  heroCta.textContent = `Try ${project.title ?? "demo"}`;
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function load() {
  try {
    const [site, projects] = await Promise.all([
      fetchJson("site.json").catch(() => null),
      fetchJson("projects.json"),
    ]);

    applySite(site);

    grid.innerHTML = "";
    if (projects.length === 0) {
      count.textContent = "0 projects";
      projectsEmpty.hidden = false;
      heroSpotlight.hidden = true;
      return;
    }

    projectsEmpty.hidden = true;
    for (const p of projects) grid.appendChild(projectCard(p));

    const n = projects.length;
    count.textContent = `${n} project${n === 1 ? "" : "s"}`;
    applyFeatured(pickFeatured(projects));
  } catch (e) {
    grid.innerHTML = "";
    count.textContent = "Error";
    projectsEmpty.hidden = true;
    grid.appendChild(
      el("div", { class: "card card-error", role: "listitem" }, [
        el("div", { class: "card-title" }, [el("h3", { class: "card-name" }, ["Could not load projects"])]),
        el("p", { class: "desc" }, ["Refresh the page or check that projects.json is available."]),
      ]),
    );
    console.error(e);
  }
}

load();
