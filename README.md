# Coal Route Finder

Web app to find high-coal mining routes across Minecraft coal ore clusters.

## Setup

```bash
npm install
```

Ensure cluster data is served at `/ore_clusters.json`. The repo keeps the file at the project root; create a hard link in `public` (avoids duplicating the large file on Windows):

```powershell
New-Item -ItemType HardLink -Path "public\ore_clusters.json" -Target "ore_clusters.json"
```

Or copy the file into `public/ore_clusters.json`.

## Run

```bash
npm run dev
```

Open the URL shown in the terminal (default `http://localhost:5173`).

## Export format

Waypoint coordinates only (no header):

```
462 182 766
...
```

## Algorithm

1. Filter clusters by min/max block count and optional region bounds.
2. Build a spatial index of neighbors within `maxDistance` (3D).
3. Try multiple high-value start points; greedily extend to maximize coal per hop.
4. Apply light 2-opt path improvements while keeping hop constraints.

Results are heuristic (not guaranteed globally optimal) but fast on ~30k clusters.
