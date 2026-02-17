# D&D Master Codex

A clean, fast, offline-capable **Dungeon Master's reference tool** built with vanilla HTML, CSS, and JavaScript.  
Browse 5th Edition rules, classes, races, spells, monsters, magic items, feats, combat mechanics, conditions, and more — all in one elegant interface.

![D&D Master Codex Screenshot](https://via.placeholder.com/1280x720/1a1a1a/ffffff?text=D%26D+Master+Codex+Interface)  
*(replace with real screenshot when you have one)*

## Features

- **Dark parchment-themed UI** with sidebar navigation
- **Local feats database** (from Xanathar's, Mordenkainen's, PHB) — no API calls needed
- **Live Open5e API integration** for:
  - Spells (all classes + full spell lists)
  - Monsters (with stat blocks)
  - Races & subraces
  - Classes (with archetypes & tables)
  - Magic Items (with rarity coloring)
  - Conditions, combat rules, equipment, backgrounds, etc.
- **Global search** (currently focused on monsters — easily extensible)
- **Responsive modal detail views** with Markdown-rendered descriptions
- **Pagination** support for large lists
- **Marked.js** for beautiful markdown rendering
- Mobile-friendly layout (sidebar scrolls independently)

## Screenshots

*(Add 2–4 screenshots here — sidebar open, spell modal, monster stat block, feats table)*

## Tech Stack

- HTML5
- CSS (custom dark / parchment theme)
- Vanilla JavaScript (no frameworks)
- [marked.js](https://github.com/markedjs/marked) — Markdown parser
- [Open5e API](https://api.open5e.com/) — SRD + community content
- Local JSON data for feats (XGE, PHB, MTF)

## Installation & Usage

### Option 1: Run locally (recommended for DMs)

1. Download or clone this repository
2. Open `index.html` in any modern browser  
   → Chrome, Firefox, Edge, Safari all work great
3. No server required — works completely offline for local feats & cached content

### Option 2: Use as Progressive Web App (PWA)

1. Open in Chrome / Edge
2. Click the install icon in the address bar (or menu → Install app…)
3. Now available from your desktop / start menu — even works offline after first load

## Project Structure

```text
dnd-master-codex/
├── index.html          # Main application file
├── style.css           # All visual styling (parchment + dark theme)
├── script.js           # Core logic: fetching, rendering, modal, search
├── feats.json          # Local feats data (PHB, XGE, MTF)
└── README.md
```

## How to Extend / Customize

### Add more local data

Just follow the `feats.json` structure and update `renderResults()` + `viewDetails('local-…')` logic.

### Improve search

Currently only searches monsters. You can extend `handleSearch()` to query other endpoints:

```js
// Example: search spells too
if (currentCategory === 'spells') {
    fetch(`${API_BASE}/spells/?search=${query}&limit=50`)
}
```

### Add new local categories

Copy the feats pattern:

1. Create `newcategory.json`
2. Modify `fetchData()` to load it when `target === 'newcategory'`
3. Update `renderResults()` and `viewDetails()` accordingly

## Known Limitations

- Search currently only works well for monsters
- No offline caching of Open5e API content (only local feats are offline)
- No character sheet / builder functionality (pure reference tool)
- API rate limits may apply during heavy use

## Contributing

Pull requests welcome!  
Especially appreciated:

- Better mobile/responsive tweaks
- Additional local JSON datasets (conditions, weapons lists, etc.)
- Full offline support via Service Worker
- Search across all categories
- Dark mode toggle / theme switcher

## License

MIT License — feel free to use, modify, and share for your home games or streams.

Built with love for D&D 5e tables everywhere.

May your rolls be high and your session zero drama-free. 🎲

```

Feel free to copy-paste this directly into a `README.md` file.

Let me know if you'd like:

- A shorter version
- GitHub-flavored badges (stars, license, etc.)
- Sections for future roadmap / planned features
- Specific credits for icons/fonts if you're using any

Happy DMing!
