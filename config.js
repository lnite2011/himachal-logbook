// Everything that is specific to this trip lives here. The page content itself
// is never copied into the site: it is fetched live from the Markdown files in
// the (private) planning repo, so editing a .md file and pushing is all it takes.
window.TRIP = {
  name: "Himachal",
  repo: { owner: "lnite2011", name: "travel-planning", ref: "main", path: "trips/himachal-2026-10" },

  // When served from `python -m http.server --directory trips` (see
  // .claude/launch.json) the site reads the local files instead of GitHub.
  // The site sits at /himachal-2026-10/website/app/, the Markdown two levels up.
  localBase: "../../",

  // Chapters = the Markdown files, in reading order.
  chapters: [
    { id: "summary",         file: "summary.md",         title: "The shape of it",     icon: "compass",  img: "dhankar",     blurb: "Route, decisions and the weather watch" },
    { id: "itinerary",       file: "itinerary.md",       title: "Day by day",          icon: "scroll",   img: "key",         blurb: "Eleven days, hour by hour, with bookings" },
    { id: "permits",         file: "permits.md",         title: "Permits & visas",     icon: "stamp",    img: "kaza",        blurb: "OCI, the T1 visa and the protected-area permit" },
    { id: "food",            file: "food.md",            title: "Where to eat",        icon: "bowl",     img: "mcleod",      blurb: "Momos, thukpa and good coffee" },
    { id: "packing",         file: "packing.md",         title: "Packing",             icon: "pack",     img: "kunzum",      blurb: "Layers, medicines and where to buy them" },
    { id: "shopping-list",   file: "shopping-list.md",   title: "Shopping list",       icon: "bag",      img: "palampur",    blurb: "What still needs buying" },
    { id: "budget",          file: "budget.md",          title: "Budget",              icon: "coin",     img: "tabo",        blurb: "Who paid what" },
    { id: "todo",            file: "TODO.md",            title: "To do & deadlines",   icon: "check",    img: "norbulingka", blurb: "Next steps, first thing first" },
    { id: "paths",           file: "paths.md",           title: "Two paths",           icon: "fork",     img: "langza",      blurb: "How the trip forked, and why we chose" },
    { id: "fallback-lahaul", file: "fallback-lahaul.md", title: "Plan B: Lahaul",      icon: "snow",     img: "chandrataal", blurb: "If Kunzum closes behind us" },
    { id: "options-log",     file: "options-log.md",     title: "Options log",         icon: "book",     img: "kangra",      blurb: "Everything we compared and rejected" },
    { id: "outreach",        file: "outreach.md",        title: "Outreach",            icon: "mail",     img: "sissu",       blurb: "Operators, messages and replies" },
  ],

  // The photo strip on the home page.
  gallery: [
    { img: "norbulingka", cap: "Norbulingka" }, { img: "kangra", cap: "Kangra Fort" }, { img: "manali", cap: "Atal Tunnel" },
    { img: "sissu", cap: "Sissu" }, { img: "kunzum", cap: "Kunzum La" }, { img: "key", cap: "Key Gompa" },
    { img: "langza", cap: "Langza" }, { img: "kibber", cap: "Kibber" }, { img: "dhankar", cap: "Dhankar" },
    { img: "tabo", cap: "Tabo" }, { img: "chandrataal", cap: "Chandra Taal" }, { img: "palampur", cap: "Palampur tea" },
  ],

  // The trip map. Coordinates are approximate (villages, passes, sights) and the
  // drawn roads are simplified, not turn-by-turn. Days come from itinerary.md.
  map: {
    center: [32.15, 77.3], zoom: 8,
    // where we sleep, and which days we're there
    places: {
      sidhpur:  { name: "Sidhpur",   ll: [32.2113, 76.3190], days: [1, 2] },
      manali:   { name: "Manali",    ll: [32.2432, 77.1892], days: [3] },
      sissu:    { name: "Sissu",     ll: [32.4883, 77.1137], days: [4, 8] },
      kaza:     { name: "Kaza",      ll: [32.2276, 78.0710], days: [5, 6, 7] },
      palampur: { name: "Palampur",  ll: [32.1109, 76.5363], days: [9] },
      delhi:    { name: "Delhi",     ll: [28.5562, 77.1000], days: [10] },
    },
    // little stops worth a dot
    sights: [
      { day: 1, name: "Gaggal airport", ll: [32.1651, 76.2634] },
      { day: 2, name: "Kangra Fort", ll: [32.0867, 76.2630] },
      { day: 2, name: "McLeod Ganj", ll: [32.2426, 76.3213] },
      { day: 3, name: "Hadimba Temple", ll: [32.2480, 77.1800] },
      { day: 4, name: "Atal Tunnel", ll: [32.3677, 77.1357] },
      { day: 5, name: "Kunzum La, 4,590 m", ll: [32.3956, 77.6286] },
      { day: 6, name: "Key Gompa", ll: [32.2996, 78.0106] },
      { day: 6, name: "Kibber", ll: [32.3300, 78.0140] },
      { day: 6, name: "Langza", ll: [32.2760, 78.0710] },
      { day: 7, name: "Dhankar", ll: [32.1038, 78.2186] },
      { day: 7, name: "Tabo", ll: [32.0931, 78.3852] },
      { day: 8, name: "Chandra Taal", ll: [32.4756, 77.6147] },
    ],
    // the roads, one piece per day. type: drive | side | fly
    segments: [
      { day: 1, type: "drive", pts: [[32.1651, 76.2634], [32.19, 76.29], [32.2113, 76.3190]] },
      { day: 2, type: "side", pts: [[32.2113, 76.3190], [32.15, 76.27], [32.0867, 76.2630], [32.17, 76.30], [32.2426, 76.3213]] },
      { day: 3, type: "drive", pts: [[32.2113, 76.3190], [32.1109, 76.5363], [32.05, 76.65], [31.99, 76.79], [31.95, 76.95], [31.9576, 77.1095], [32.2432, 77.1892]] },
      { day: 4, type: "drive", pts: [[32.2432, 77.1892], [32.3677, 77.1357], [32.4883, 77.1137]] },
      { day: 5, type: "drive", pts: [[32.4883, 77.1137], [32.4333, 77.2167], [32.40, 77.30], [32.35, 77.57], [32.3956, 77.6286], [32.37, 77.98], [32.2276, 78.0710]] },
      { day: 6, type: "side", pts: [[32.2276, 78.0710], [32.2996, 78.0106], [32.3300, 78.0140], [32.2760, 78.0710], [32.2276, 78.0710]] },
      { day: 7, type: "side", pts: [[32.2276, 78.0710], [32.1038, 78.2186], [32.0931, 78.3852]] },
      { day: 8, type: "drive", pts: [[32.2276, 78.0710], [32.37, 77.98], [32.3956, 77.6286], [32.35, 77.57], [32.4756, 77.6147], [32.35, 77.57], [32.40, 77.30], [32.4333, 77.2167], [32.4883, 77.1137]] },
      { day: 9, type: "drive", pts: [[32.4883, 77.1137], [32.3677, 77.1357], [32.2432, 77.1892], [31.9576, 77.1095], [31.7088, 76.9320], [31.99, 76.79], [32.05, 76.65], [32.1109, 76.5363]] },
      { day: 10, type: "drive", pts: [[32.1109, 76.5363], [32.1651, 76.2634]] },
      { day: 10, type: "fly", pts: [[32.1651, 76.2634], [30.4, 76.6], [28.5562, 77.1000]] },
    ],
  },

  // Sunrise at the day's start place, sunset at its end place (IST). See itinerary.md § Sunrise & sunset.
  sun: {
    1: { a: "Gaggal", b: "Sidhpur", rise: "06:18", set: "18:09", dark: "18:34", light: "11h 51m" },
    2: { a: "Sidhpur", b: "Sidhpur", rise: "06:19", set: "18:08", dark: "18:32", light: "11h 49m" },
    3: { a: "Sidhpur", b: "Manali", rise: "06:19", set: "18:03", dark: "18:28", light: "11h 44m" },
    4: { a: "Manali", b: "Koksar", rise: "06:17", set: "18:02", dark: "18:26", light: "11h 45m" },
    5: { a: "Koksar", b: "Kaza", rise: "06:17", set: "17:57", dark: "18:22", light: "11h 40m" },
    6: { a: "Kaza", b: "Kaza", rise: "06:14", set: "17:56", dark: "18:20", light: "11h 42m" },
    7: { a: "Kaza", b: "Kaza", rise: "06:15", set: "17:55", dark: "18:19", light: "11h 40m" },
    8: { a: "Kaza", b: "Koksar", rise: "06:16", set: "17:57", dark: "18:21", light: "11h 41m" },
    9: { a: "Koksar", b: "Palampur", rise: "06:20", set: "17:58", dark: "18:23", light: "11h 38m" },
    10: { a: "Palampur", b: "Delhi", rise: "06:23", set: "17:57", dark: "18:21", light: "11h 34m" },
    11: { a: "Delhi", b: "Delhi", rise: "06:19", set: "17:56", dark: "18:20", light: "11h 37m" },
  },

  // Which photo illustrates which day (falls back to the prayer flags).
  dayImages: { 1: "norbulingka", 2: "kangra", 3: "manali", 4: "sissu", 5: "kunzum", 6: "key", 7: "dhankar", 8: "chandrataal", 9: "palampur", 10: "delhi", 11: "flags" },
};
