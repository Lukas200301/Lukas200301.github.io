# Lukas200301.github.io

Personal site: projects, browser tools and games. Plain HTML, CSS and JavaScript on GitHub Pages, so there's no build step. Push to `main` and it's live.

**Live:** https://lukas200301.github.io

## What's on it

- **Home**: particle-rendered name you can push around and click, live Discord presence (Lanyard), live GitHub stats, contribution calendar, recently pushed repos, and the site's `lsh` shell embedded at the bottom (same session as the full-screen command line).
- **Projects**: every public repo from the GitHub API, with search, language filters and sorting. Raspberry Pi Control and NetW1re have full showcase pages.
- **Tools**: 19 client-side utilities:
  - Developer: JS/TS playground, regex tester, JSON & YAML formatter, Base64 / URL / JWT decoder, cron expression helper, text diff checker
  - Network & security: subnet calculator, DNS lookup (DNS-over-HTTPS, SPF/DMARC check), MAC address vendor lookup, hash & checksum generator, password generator, browser fingerprint analyzer
  - Everything else: unit converter (GB vs GiB, Mbit/s vs MB/s, transfer times), timestamp converter with world clock, Markdown live preview, QR codes, color palettes, Globedata, YouTube tags
- **Stats**: GitHub activity in charts: all-time contributions, a repository timeline (created → last push), current and longest streak, contributions per month, an activity calendar for any year, average per weekday, busiest days, share of code per language, new repositories per year and a sortable repository table. Every chart has a table view and hover details.
- **Games**: Tetris, 2048, Globle, Snake, Minesweeper, Flag Quiz, Code Typing Test, Tech Memory, Tic Tac Toe (unbeatable on hard).

### Site-wide features

| Feature | How |
| --- | --- |
| Jump anywhere | `Ctrl` / `⌘` + `K` opens the command palette (pages, tools, games, repos, actions) |
| Shortcuts | `?` shows them all · `G` then `H`/`P`/`T`/`G`/`S` navigates · `/` focuses search on list pages |
| Page transitions | Boot-screen overlay: drifting grid, name letters rising, corner brackets, radar ring, loading bar and a typed `cd ~/page`; the panel then lifts off the next page with a glowing edge (works in every browser, also from disk) |
| Command line | The key left of `1` (`` ` `` / `^`), the `>_` button or Ctrl+K → *Open command line*. The site is a file system: `ls`, `cd tools/hash`, `open snake`, `tree`, `find`, `cat stats`, `now`, `neofetch`, Tab completion and history. It stays open across page changes (`js/cli.js`) |
| Now playing | Pill in the bottom-left on every page showing what I'm listening to on Spotify or coding in, live through Lanyard's WebSocket with a REST fallback. Click for album art and progress; hidden on game screens (`js/live.js`) |
| Easter egg | ↑ ↑ ↓ ↓ ← → ← → B A |
| 404 page | `404.html`, served by GitHub Pages for any missing URL |
| Live background | Signal grid on every page: twinkling dots, scan wave, auto pings, data packets, cursor lens, click a blank spot for a sonar ping |
| Motion | Word-by-word headings, staggered scroll reveals, hero parallax, cursor ring, click ripples, letter-roll hover on links and buttons, light-wave titles |
| Live monitor | Home page panel measuring the visitor's own browser every 500 ms (frame rate, main-thread delay, scroll, device info) |
| Saved progress | High scores, best times and tool settings are kept in `localStorage` |
| Reduced motion | All animation is disabled when the OS asks for it |

## Structure

```
/
├── index.html            Home
├── 404.html              Not-found page (works from disk and on GitHub Pages)
├── css/
│   ├── styles.css        Design tokens + site shell (header, palette, footer, toasts)
│   ├── pages.css         Shared components for project / tool / game pages and list pages
│   ├── apps.css          UI kit for the newer tools and games (panels, inputs, stats, overlays)
│   └── home.css          Home-only layout
├── js/
│   ├── script.js         Site shell: header, command palette, shortcuts, reveal, toasts
│   ├── list.js           Search / filter / sort for the three list pages
│   ├── home.js           Particle name, GitHub + Discord data, terminal
│   ├── cli.js            Site-wide command line (loaded by script.js)
│   ├── live.js           Now-playing pill (loaded by script.js)
│   ├── terminal-font.js  JetBrains Mono for the command line, registered from bytes so it's ready on the first frame
│   └── countries-data.js Country data used by Globle, Globedata and Flag Quiz
├── projects/             List page + showcase pages (own CSS each)
├── tools/                List page + one folder per tool
├── games/                List page + one folder per game
└── stats/                GitHub statistics page (stats.js draws the SVG charts)
```

Every page loads `css/styles.css` → `css/pages.css` → its own stylesheet, and `js/script.js` at the end of `<body>`. The script injects the header, footer, palette and back-to-top button, so pages don't need to contain them.

## Adding things

**A new tool or game**
1. Create `tools/<name>/index.html` (copy an existing tool as a starting point; keep the `tool-hero` header block). The newer tools keep their logic in `tools/<name>/app.js` and use the classes from `css/apps.css`.
2. Add it to the `TOOLS` (or `GAMES`) array in `tools/index.html` / `games/index.html`.
3. Add it to `REGISTRY` in `js/script.js` so it shows up in the command palette and terminal.

**A new project showcase**
1. Create `projects/<name>/index.html` (copy one of the existing showcases).
2. Add the repo name to `SHOWCASES` in `projects/index.html` and to `REGISTRY` in `js/script.js`.

## Design tokens

Colors, type and spacing live at the top of `css/styles.css`. The palette is ink-navy (`--ink-0` … `--ink-3`) with a periwinkle signal color (`--signal`) and an amber accent for anything live (`--amber`). Headings use Martian Mono, body text uses Instrument Sans, and code uses JetBrains Mono. Older variable names (`--primary-accent`, `--surface-bg`, …) are mapped onto the new tokens, so per-tool stylesheets keep working.

## External services

- Country data for Globle, Globedata and Flag Quiz is bundled in `js/countries-data.js` (restcountries.com v3.1 was retired in 2026). Flags load from flagcdn.com, the globe from unpkg (version-pinned).
- DNS Lookup asks Cloudflare (`cloudflare-dns.com`) and Google (`dns.google`) over their DNS-over-HTTPS JSON APIs.
- MAC vendors are bundled in `tools/mac-lookup/oui.js` (IEEE registries via Wireshark's `manuf` file). Refresh it with `node tools/mac-lookup/build-oui.js manuf.txt` (instructions at the top of the script).
- Libraries from jsDelivr, version-pinned: js-yaml (JSON & YAML), marked + DOMPurify (Markdown), jsdiff (Diff)
- Logos in Tech Memory come from devicon
- GitHub REST API (unauthenticated, 60 requests/hour per visitor; responses are cached in `localStorage`). The stats page also asks for each repo's languages once and only re-asks for repos pushed since; if the hourly limit is hit it falls back to each repo's main language and says so
- [github-contributions-api](https://github.com/grubersjoe/github-contributions-api) for the contribution calendar and all stats-page activity charts
- [Lanyard](https://github.com/Phineas/lanyard) for Discord presence
- Visitor counter on Vercel

## License

MIT
