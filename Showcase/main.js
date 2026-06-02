const grid = document.getElementById("projectsGrid");
const count = document.getElementById("projectCount");
const year = document.getElementById("year");

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
    else node.appendChild(child);
  }
  return node;
}

function projectCard(p) {
  const tags = el(
    "div",
    { class: "tags" },
    (p.tags ?? []).slice(0, 6).map((t) => el("span", { class: "tag" }, [t])),
  );

  const status =
    p.status === "live"
      ? el("span", { class: "status" }, ["Live"])
      : el("span", { class: "status" }, [String(p.status ?? "Project")]);

  return el(
    "a",
    { class: "card", href: p.href ?? "#", "data-id": p.id ?? "" },
    [
      el("div", { class: "card-title" }, [
        el("h4", {}, [p.title ?? "Untitled"]),
        status,
      ]),
      el("p", { class: "desc" }, [p.description ?? ""]),
      tags,
    ],
  );
}

async function load() {
  try {
    const res = await fetch("/Skyblock-Waypoint-Route-Generator/projects.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const projects = await res.json();

    grid.innerHTML = "";
    for (const p of projects) grid.appendChild(projectCard(p));

    count.textContent = `${projects.length} project${projects.length === 1 ? "" : "s"}`;
  } catch (e) {
    grid.innerHTML = "";
    count.textContent = "Error";
    grid.appendChild(
      el("div", { class: "card", href: "#" }, [
        el("div", { class: "card-title" }, [el("h4", {}, ["Failed to load projects"])]);
      ]),
    );
    console.error(e);
  }
}

load();

