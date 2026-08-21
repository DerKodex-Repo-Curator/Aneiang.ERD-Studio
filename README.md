# Aneiang ERD Studio

A **zero-backend, zero-dependency** online database ER diagram designer that runs entirely in the browser and works offline.

Create and edit database entity-relationship diagrams with a visual canvas, import SQL DDL to reverse-engineer a schema, and export diagrams and data dictionaries in multiple formats. Everything happens locally in your browser — no account, no server, no telemetry.

> Interface icons are bundled locally (Remix Icon). The project makes **no third-party CDN requests**, so it is fully usable on air-gapped and intranet networks.

English | [简体中文](README.zh-CN.md)

## Features

- **Visual editing** — create, rename, and delete tables and fields; group rows; mark PK / FK / UK / IDX; add a standard audit column set in one click; organize tables into business domains with per-domain colors; define physical foreign keys and logical relations
- **Fast modeling** — table templates (blank / standard business table / order / inventory / user / payment / audit log), a quick common-field library, multi-line paste to batch-add fields, Enter to keep adding rows, double-click an empty canvas to create a table, and Ctrl+C / Ctrl+V to duplicate tables
- **Rich interactions** — right-click context menus on the canvas, table cards, field rows, and relations; drag-to-pan, wheel-to-zoom, card drag with 4 px grid snapping; click to focus a table's relations; connect mode (child table → parent table); table / field search; 60-step undo/redo
- **Multiple projects** — create, switch, rename, duplicate, and delete projects; data auto-saves to browser localStorage
- **Themes & canvas styles** — six UI themes (dark, midnight, light, business blue, eye-care green, paper), three canvas background patterns, and three connection line styles (curve / orthogonal / straight); exported images match the active theme
- **Auto layout** — arrange tables into columns by business domain and tidy up imported schemas in one click
- **Built-in sample** — a generic e-commerce order system (12 tables / 4 domains / 11 FKs / 3 logical relations) with no real business data

### Import

| Format | Notes |
| --- | --- |
| Project JSON | Projects exported by this tool; open as a new project or merge into the current one |
| SQL DDL | `CREATE TABLE` scripts (PostgreSQL / MySQL compatible; also handles quoted, backtick, and bracket identifiers plus schema prefixes); parses columns, types, primary keys, unique keys, indexes, inline / `ALTER` foreign keys, and column comments (`COMMENT ON COLUMN` / MySQL `COMMENT`) |

### Export

| Format | Notes |
| --- | --- |
| Project JSON | Complete project data for backup, migration, or team exchange |
| SQL · 8 dialects | PostgreSQL / MySQL / MariaDB / SQLite / SQL Server / Oracle / DaMeng DM / KingbaseES, with automatic type mapping and auto-increment primary key adaptation |
| PNG / SVG | 2x-resolution raster image / lossless vector graphic, colored to the active theme |
| Mermaid `.mmd` | Render in mermaid.live, Typora, or any Mermaid-enabled Markdown viewer |
| Excel `.xlsx` | Data dictionary with four sheets (overview / tables / fields / relations), generated with zero dependencies |

## Quick Start

### Option 1 — Open directly

Double-click `index.html` and use it in your browser (Chrome / Edge recommended).

### Option 2 — Local static server

```bash
# Python
python -m http.server 8080

# or Node
npx serve .
```

Open http://localhost:8080

### Option 3 — Docker deployment

```bash
docker build -t erd-studio .
docker run -d --name erd-studio -p 8080:80 erd-studio
```

Or with Compose:

```bash
docker compose up -d
```

Open http://<server-ip>:8080. The image is based on `nginx:alpine` (roughly 10 MB incremental) and makes no external requests.

## Data Storage

The platform has **no backend**. All project data is saved to the **current browser's** localStorage:

- Data is tied to the browser profile. Switching browsers, machines, or clearing browser data will not migrate it automatically.
- Back up important projects regularly via **Export → Project JSON**, and restore them in a new environment with **Import**.
- When several people use it on an intranet, each browser stores its own data; share projects by exchanging JSON files.

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+F` | Focus search box |
| `Ctrl+S` | Save to localStorage immediately |
| `N` | New table (template dialog) |
| `Delete` | Delete the selected table / relation |
| `Esc` | Exit connect mode / clear selection |
| `F` / `+` / `-` | Fit to window / Zoom in / Zoom out |

## Project Structure

```
├── index.html              # Entry point (no build step, no dependencies)
├── assets/
│   ├── css/
│   │   ├── base.css        # Theme variables / layout / panels / modals
│   │   ├── canvas.css      # Canvas / cards / edges / legend
│   │   └── icons.css       # Font icon subset
│   ├── js/
│   │   ├── store.js        # Data model / localStorage / undo-redo / event bus
│   │   ├── render.js       # Canvas rendering (domains / cards / edges / legend)
│   │   ├── interact.js     # Pan & zoom / drag / selection / connect mode / shortcuts
│   │   ├── editor.js       # Property panel / dialogs / project & domain management / auto layout
│   │   ├── ctxmenu.js      # Right-click context menus
│   │   ├── presets.js      # Table templates & quick-field library
│   │   ├── io.js           # Import / export (JSON / SQL / PNG / SVG / Mermaid / XLSX)
│   │   ├── sql.js          # SQL DDL parser & multi-dialect generator (8 databases)
│   │   ├── sample.js       # Built-in demo project (e-commerce, 12 tables)
│   │   └── app.js          # Startup entry
│   └── fonts/
│       ├── remixicon.woff2 # Remix Icon font (bundled locally)
│       └── NOTICE.md       # Icon license notice
├── Dockerfile              # nginx:alpine containerization
├── docker-compose.yml
├── nginx.conf
├── LICENSE                 # MIT
├── README.md
└── README.zh-CN.md
```

## Technical Notes

- Zero dependencies, zero build: plain HTML / CSS / JS, no framework, no npm, no runtime external requests
- XLSX export is a minimal built-in implementation (ZIP STORE + OOXML) with no third-party library
- PNG export serializes SVG and rasterizes it on a canvas, all inside the browser

## Repositories

- Gitee: https://gitee.com/aneiangsoft/aneiang.erd-studio
- GitHub: https://github.com/AneiangSoft/Aneiang.ERD-Studio

## License

- Code: [MIT License](LICENSE)
- Icons: [Remix Icon 4.6.0](https://remixicon.com) (Apache-2.0, bundled locally; see `assets/fonts/NOTICE.md`)
