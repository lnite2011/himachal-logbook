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

  // Which photo illustrates which day (falls back to the prayer flags).
  dayImages: { 1: "norbulingka", 2: "kangra", 3: "manali", 4: "sissu", 5: "kunzum", 6: "key", 7: "dhankar", 8: "chandrataal", 9: "palampur", 10: "delhi", 11: "flags" },
};
