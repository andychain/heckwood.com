/**
 * fetch-feeds.js
 *
 * Fetches RSS feeds for each podcast and writes:
 *   - data/podcasts/{slug}.json        (show + episodes data)
 *   - content/podcasts/{slug}/_index.md (show content page)
 *   - content/podcasts/{slug}/{ep}.md  (episode content pages)
 *
 * Run: node fetch-feeds.js
 * Or via: npm run build
 */

import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";
import slugify from "slugify";
import fs from "fs";
import path from "path";

// ════════════════════════════════════════════════
// ★ YOUR SHOWS — add or remove podcasts here
//   name:   display name
//   author: host / producer
//   feed:   RSS feed URL
//   cat:    category slug (tech | science | news | business | crime)
//   desc:   short description for SEO (1–2 sentences)
// ════════════════════════════════════════════════
const SHOWS = [
  {
    name: "Lex Fridman Podcast",
    author: "Lex Fridman",
    feed: "https://lexfridman.com/feed/podcast/",
    cat: "tech",
    desc: "Conversations about science, technology, history, philosophy and the nature of intelligence and consciousness.",
  },
  {
    name: "Huberman Lab",
    author: "Andrew Huberman",
    feed: "https://feeds.megaphone.fm/hubermanlab",
    cat: "science",
    desc: "Dr. Andrew Huberman discusses neuroscience and science-based tools for everyday life.",
  },
  {
    name: "The Daily",
    author: "The New York Times",
    feed: "https://feeds.simplecast.com/54nAGcIl",
    cat: "news",
    desc: "Twenty minutes on the biggest story of the day with Times journalists, every weekday morning.",
  },
  {
    name: "How I Built This",
    author: "Guy Raz / NPR",
    feed: "https://feeds.npr.org/510313/podcast.xml",
    cat: "business",
    desc: "Guy Raz dives into the stories behind the world's best-known companies and entrepreneurs.",
  },
  {
    name: "Serial",
    author: "Serial Productions",
    feed: "https://feeds.megaphone.fm/serial",
    cat: "crime",
    desc: "Investigative journalism on real-world cases told as gripping serialised stories.",
  },
  {
    name: "Darknet Diaries",
    author: "Jack Rhysider",
    feed: "https://feeds.megaphone.fm/darknetdiaries",
    cat: "tech",
    desc: "True stories from the dark side of the internet — hacks, breaches, and cyber crime.",
  },
  {
    name: "Radiolab",
    author: "WNYC Studios",
    feed: "https://feeds.wnyc.org/radiolab_podcast",
    cat: "science",
    desc: "Radiolab explores big questions about human experience through science, philosophy and storytelling.",
  },
  {
    name: "Planet Money",
    author: "NPR",
    feed: "https://feeds.npr.org/510289/podcast.xml",
    cat: "business",
    desc: "Planet Money explains economics and the global economy through entertaining storytelling.",
  },
  {
    name: "This American Life",
    author: "This American Life",
    feed: "https://feed.thisamericanlife.org/talpodcast",
    cat: "news",
    desc: "Weekly public radio program featuring personal essays, memoirs, documentary journalism and fiction.",
  },
  {
    name: "a16z Podcast",
    author: "Andreessen Horowitz",
    feed: "https://feeds.simplecast.com/4T39_jAj",
    cat: "tech",
    desc: "The a16z Podcast discusses tech and culture trends with industry experts and thinkers.",
  },
];
// ════════════════════════════════════════════════

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "__cdata",
  allowBooleanAttributes: true,
});

function slug(str) {
  return slugify(str, { lower: true, strict: true, trim: true }).slice(0, 80);
}

function clean(str) {
  if (!str) return "";
  return String(str)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getText(val) {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val.__cdata) return val.__cdata;
  if (val["#text"]) return val["#text"];
  return String(val);
}

function parseDuration(dur) {
  if (!dur) return null;
  const s = String(dur).trim();
  if (s.includes(":")) {
    const parts = s.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
  }
  const n = parseInt(s);
  return isNaN(n) ? null : n;
}

function fmtDuration(sec) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function escapeYAML(str) {
  return String(str || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .trim();
}

async function fetchFeed(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Podwave/1.0)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function processShow(show) {
  const showSlug = slug(show.name);
  console.log(`\n▶ ${show.name} (${showSlug})`);

  let xml;
  try {
    xml = await fetchFeed(show.feed);
  } catch (e) {
    console.error(`  ✗ Feed fetch failed: ${e.message}`);
    return;
  }

  let parsed;
  try {
    parsed = parser.parse(xml);
  } catch (e) {
    console.error(`  ✗ XML parse failed: ${e.message}`);
    return;
  }

  const channel = parsed?.rss?.channel || parsed?.feed;
  if (!channel) {
    console.error(`  ✗ No channel found`);
    return;
  }

  // Show-level metadata
  const feedTitle = clean(getText(channel.title)) || show.name;
  const feedDesc = clean(getText(channel.description || channel.subtitle)) || show.desc;
  const feedArt =
    channel["itunes:image"]?.["@_href"] ||
    channel.image?.url ||
    channel["itunes:image"] ||
    "";
  const feedLink = getText(channel.link) || "";

  // Episodes
  const rawItems = Array.isArray(channel.item)
    ? channel.item
    : channel.item
    ? [channel.item]
    : [];

  const episodes = rawItems
    .map((item) => {
      const title = clean(getText(item.title || item["itunes:title"]));
      if (!title) return null;

      const epSlug = slug(title) || `episode-${Date.now()}`;
      const description =
        clean(getText(item["content:encoded"] || item.description || item["itunes:summary"])) || "";
      const shortDesc = description.slice(0, 300);
      const audioUrl =
        item.enclosure?.["@_url"] ||
        (Array.isArray(item.enclosure) ? item.enclosure[0]?.["@_url"] : "") ||
        "";
      const pubDateRaw = getText(item.pubDate || item.published || item.updated || "");
      const pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString().slice(0, 10) : "";
      const durationSec = parseDuration(getText(item["itunes:duration"]));
      const duration = fmtDuration(durationSec);
      const epNum = getText(item["itunes:episode"] || "");
      const season = getText(item["itunes:season"] || "");
      const epArt =
        item["itunes:image"]?.["@_href"] || item["itunes:image"] || feedArt;

      return {
        slug: epSlug,
        title,
        description: shortDesc,
        audioUrl,
        pubDate,
        duration,
        durationSec,
        epNum,
        season,
        art: epArt || feedArt,
      };
    })
    .filter(Boolean);

  console.log(`  ✓ ${episodes.length} episodes`);

  // ── Write data file ──
  const dataDir = path.join("data", "podcasts");
  fs.mkdirSync(dataDir, { recursive: true });
  const dataObj = {
    slug: showSlug,
    name: show.name,
    author: show.author,
    cat: show.cat,
    feed: show.feed,
    desc: show.desc,
    feedTitle,
    feedDesc: feedDesc.slice(0, 500),
    art: feedArt,
    link: feedLink,
    episodeCount: episodes.length,
    episodes,
  };
  fs.writeFileSync(
    path.join(dataDir, `${showSlug}.json`),
    JSON.stringify(dataObj, null, 2)
  );

  // ── Write show content page ──
  const showDir = path.join("content", "podcasts", showSlug);
  fs.mkdirSync(showDir, { recursive: true });

  const showFrontmatter = `---
title: "${escapeYAML(show.name)} Podcast"
description: "${escapeYAML(feedDesc.slice(0, 160))}"
slug: "${showSlug}"
author: "${escapeYAML(show.author)}"
categories: ["${show.cat}"]
art: "${escapeYAML(feedArt)}"
feed: "${escapeYAML(show.feed)}"
episodeCount: ${episodes.length}
lastFetched: "${new Date().toISOString().slice(0, 10)}"
layout: "show"
---
`;
  fs.writeFileSync(path.join(showDir, "_index.md"), showFrontmatter);

  // ── Write episode content pages ──
  const epSlugs = new Map();
  for (const ep of episodes) {
    // Deduplicate slugs
    let finalSlug = ep.slug;
    let n = 1;
    while (epSlugs.has(finalSlug)) {
      finalSlug = `${ep.slug}-${n++}`;
    }
    epSlugs.set(finalSlug, true);

    const epFrontmatter = `---
title: "${escapeYAML(ep.title)}"
description: "${escapeYAML(ep.description.slice(0, 160))}"
slug: "${finalSlug}"
showName: "${escapeYAML(show.name)}"
showSlug: "${showSlug}"
showAuthor: "${escapeYAML(show.author)}"
audioUrl: "${escapeYAML(ep.audioUrl)}"
pubDate: "${ep.pubDate}"
duration: "${ep.duration}"
durationSec: ${ep.durationSec || 0}
art: "${escapeYAML(ep.art)}"
layout: "episode"
---

${ep.description}
`;
    fs.writeFileSync(path.join(showDir, `${finalSlug}.md`), epFrontmatter);
  }

  console.log(`  ✓ Content pages written`);
}

async function main() {
  console.log("Podwave — fetching RSS feeds\n" + "=".repeat(40));

  // Clean old content
  const contentDir = path.join("content", "podcasts");
  if (fs.existsSync(contentDir)) {
    fs.rmSync(contentDir, { recursive: true });
  }
  fs.mkdirSync(contentDir, { recursive: true });

  // Write podcasts section index
  fs.writeFileSync(
    path.join(contentDir, "_index.md"),
    `---
title: "Podcast Directory"
description: "Browse our curated podcast directory. Find top shows in tech, science, news, business and true crime."
layout: "list"
---
`
  );

  // Process all shows
  for (const show of SHOWS) {
    await processShow(show);
  }

  console.log("\n" + "=".repeat(40));
  console.log("✓ All feeds processed. Run `hugo` to build.");
}

main().catch(console.error);
