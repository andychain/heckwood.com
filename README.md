# Podwave

A SEO-first podcast directory built with Hugo. Every show and episode gets its own static HTML page.

## Project structure

```
podwave/
├── fetch-feeds.js        ← fetches RSS feeds, writes Hugo content + data
├── package.json
├── hugo.toml             ← Hugo config (update baseURL to your domain)
├── layouts/
│   ├── _default/
│   │   ├── baseof.html   ← base template (header, footer, SEO tags)
│   │   └── taxonomy.html ← category pages
│   ├── index.html        ← homepage
│   └── podcasts/
│       ├── list.html     ← /podcasts/ directory
│       ├── show.html     ← /podcasts/show-name/
│       └── episode.html  ← /podcasts/show-name/episode-title/
├── static/
│   ├── css/main.css
│   └── robots.txt
└── data/podcasts/        ← auto-generated JSON per show (git-ignored)
```

## Local development

```bash
# 1. Install dependencies
npm install

# 2. Install Hugo (macOS)
brew install hugo

# 3. Fetch RSS feeds + build
npm run build

# 4. Preview locally
hugo server
# → open http://localhost:1313
```

## Adding or removing shows

Edit the `SHOWS` array in `fetch-feeds.js`:

```js
const SHOWS = [
  {
    name: "My Podcast",
    author: "Host Name",
    feed: "https://example.com/feed.xml",  // RSS feed URL
    cat: "tech",   // tech | science | news | business | crime
    desc: "Short description for SEO.",
  },
  // ...
];
```

Then run `npm run build` — all pages regenerate automatically.

## Deploying to Cloudflare Pages

1. Push this repo to GitHub
2. Go to dash.cloudflare.com → Workers & Pages → Create a project
3. Connect your GitHub repo
4. Set build settings:
   - **Build command:** `npm install && npm run build`
   - **Build output directory:** `public`
5. Add environment variables:
   - `HUGO_VERSION` = `0.128.0`
   - `NODE_VERSION` = `20`
6. Click Deploy

Every `git push` auto-deploys.

## SEO features

- Every show: `/podcasts/show-name/` with full meta tags
- Every episode: `/podcasts/show-name/episode-title/` with Schema.org markup
- Category pages: `/categories/tech/`, `/categories/science/`, etc.
- Auto-generated `sitemap.xml` and `robots.txt`
- Open Graph + Twitter Card tags on every page
- Breadcrumb navigation on all inner pages
- Static HTML — no JS required for Google to index content

## Updating content

RSS feeds are fetched at build time. To refresh episode lists:

```bash
npm run build
git add -A && git commit -m "update episodes" && git push
```

Cloudflare Pages will deploy the update automatically.
