# Lukas200301.github.io

Personal site: projects, browser tools and games. Plain HTML, CSS and JavaScript on GitHub Pages, so there's no build step. Push to `main` and it's live.

**Live:** https://lukas200301.github.io

## What's on it

- **Home**: particle-rendered name you can push around and click, live Discord presence (Lanyard), live GitHub stats, contribution calendar, recently pushed repos, and an interactive terminal (`help`, `projects`, `open tetris`, …).
- **Projects**: every public repo from the GitHub API, with search, language filters and sorting. Raspberry Pi Control and NetW1re have full showcase pages.
- **Tools**: 8 client-side utilities (password generator, regex tester, QR codes, color palettes, JS/TS playground, fingerprint analyzer, Globedata, YouTube tags).
- **Games**: Tetris, 2048, Globle.

### Site-wide features

| Feature | How |
| --- | --- |
| Jump anywhere | `Ctrl` / `⌘` + `K` opens the command palette (pages, tools, games, repos, actions) |
| Shortcuts | `?` shows them all · `G` then `H`/`P`/`T`/`G` navigates · `/` focuses search on list pages |
| Page transitions | Boot-screen overlay: drifting grid, name letters rising, corner brackets, radar ring, loading bar and a typed `cd ~/page`; the panel then lifts off the next page with a glowing edge (works in every browser, also from disk) |
| Easter egg | ↑ ↑ ↓ ↓ ← → ← → B A |
| 404 page | `404.html`, served by GitHub Pages for any missing URL |
| Live background | Signal grid on every page: twinkling dots, scan wave, auto pings, data packets, cursor lens, click a blank spot for a sonar ping |
| Motion | Word-by-word headings, staggered scroll reveals, hero parallax, cursor ring, magnetic buttons, click ripples, letter-roll hover on links and buttons, light-wave titles |
| Live monitor | Home page panel measuring the visitor's own browser every 500 ms (frame rate, main-thread delay, scroll, device info) |
| Reduced motion | All animation is disabled when the OS asks for it |

## Structure

```
/
├── index.html            Home
├── 404.html              Not-found page (works from disk and on GitHub Pages)
├── css/
│   ├── styles.css        Design tokens + site shell (header, palette, footer, toasts)
│   ├── pages.css         Shared components for project / tool / game pages and list pages
│   └── home.css          Home-only layout
├── js/
│   ├── script.js         Site shell: header, command palette, shortcuts, reveal, toasts
│   ├── list.js           Search / filter / sort for the three list pages
│   ├── home.js           Particle name, GitHub + Discord data, terminal
│   └── countries-data.js Country data used by Globle and Globedata
├── projects/             List page + showcase pages (own CSS each)
├── tools/                List page + one folder per tool
└── games/                List page + one folder per game
```

Every page loads `css/styles.css` → `css/pages.css` → its own stylesheet, and `js/script.js` at the end of `<body>`. The script injects the header, footer, palette and back-to-top button, so pages don't need to contain them.

## Adding things

**A new tool or game**
1. Create `tools/<name>/index.html` (copy an existing tool as a starting point; keep the `tool-hero` header block).
2. Add it to the `TOOLS` (or `GAMES`) array in `tools/index.html` / `games/index.html`.
3. Add it to `REGISTRY` in `js/script.js` so it shows up in the command palette and terminal.

**A new project showcase**
1. Create `projects/<name>/index.html` (copy one of the existing showcases).
2. Add the repo name to `SHOWCASES` in `projects/index.html` and to `REGISTRY` in `js/script.js`.

## Design tokens

Colors, type and spacing live at the top of `css/styles.css`. The palette is ink-navy (`--ink-0` … `--ink-3`) with a periwinkle signal color (`--signal`) and an amber accent for anything live (`--amber`). Headings use Martian Mono, body text uses Instrument Sans, and code uses JetBrains Mono. Older variable names (`--primary-accent`, `--surface-bg`, …) are mapped onto the new tokens, so per-tool stylesheets keep working.

## External services

- Country data for Globle and Globedata is bundled in `js/countries-data.js` (restcountries.com v3.1 was retired in 2026). Flags load from flagcdn.com, the globe from unpkg (version-pinned).
- GitHub REST API (unauthenticated, 60 requests/hour per visitor; responses are cached in `localStorage` for 10 minutes)
- [github-contributions-api](https://github.com/grubersjoe/github-contributions-api) for the contribution calendar
- [Lanyard](https://github.com/Phineas/lanyard) for Discord presence
- Visitor counter on Vercel

## License

MIT
