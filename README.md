# ReadTrack v4 — Deployment Guide

A smart study management app for medical students.  
Built with React + Vite + Tailwind CSS. Deployable to Netlify in minutes.

---

## 📁 Project Structure

```
readtrack/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          ← Full application
│   ├── migration.js     ← Data migration from older versions
│   ├── main.jsx         ← React entry point
│   └── index.css        ← Tailwind + global styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── netlify.toml         ← Netlify build config (auto-detected)
```

---

## 🚀 Deploy to Netlify (3 ways)

### Option A — Netlify Drop (fastest, no account needed for a test)
1. Run `npm run build` locally (see below)
2. Drag the `dist/` folder to **drop.netlify.com**
3. Done — you get a live URL instantly

### Option B — GitHub + Netlify (recommended for updates)
1. Push this folder to a GitHub repository
2. Go to **app.netlify.com → Add new site → Import from Git**
3. Select your repo
4. Netlify auto-detects `netlify.toml` — just click **Deploy**
5. Every `git push` to `main` will auto-deploy

### Option C — Netlify CLI
```bash
npm install -g netlify-cli
netlify login
npm run build
netlify deploy --prod --dir=dist
```

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
npm run dev

# 3. Open http://localhost:5173
```

---

## 🏗️ Build for Production

```bash
npm run build
# Output goes to dist/
# Preview it locally:
npm run preview
```

---

## 🔄 Data Migration (Automatic)

When a user visits the updated app, **migration runs automatically on first load**:

- Checks `localStorage` for `rpt-v3`, `rpt-v2`, `rpt-v1`, or `readProgressTracker`
- If found → migrates all subjects, topics, assignments, exams, and MCQ sessions
- Saves migrated data under the new `rpt-v4` key
- **Original data is preserved** under the old key (not deleted)
- Shows a green confirmation banner in the bottom-right corner
- Migration is **idempotent** — safe to run on every page load

**What migrates:**
- ✅ Subjects (name, code, colour, semester, notes)
- ✅ Topics (title, subject link, status, priority, tags, notes, summary)
- ✅ Assignments (title, due date, status, lecturer, notes)
- ✅ Exams (name, date, time, venue, type, notes)
- ✅ MCQ Sessions (topic, score, questions)
- ✅ Profile (name, theme preference)

**What doesn't migrate:**
- ⚠️ Uploaded documents — binary file content can't be stored in plain JSON.
  Users will need to re-upload documents (a one-time step).

---

## ⚙️ Environment & AI Features

The app calls the Anthropic Claude API directly from the browser using the
standard `/v1/messages` endpoint. This works automatically in the Claude.ai
artifact environment.

**For your own Netlify deployment**, you have two options:

### Option 1 — Netlify Functions proxy (recommended for production)
Create `netlify/functions/claude.js`:
```js
exports.handler = async (event) => {
  const body = JSON.parse(event.body);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { statusCode: 200, body: JSON.stringify(data) };
};
```

Then in your Netlify dashboard → **Environment variables** → add:
```
ANTHROPIC_API_KEY = sk-ant-...
```

And update all `fetch("https://api.anthropic.com/v1/messages", ...)` calls
in `App.jsx` to `fetch("/.netlify/functions/claude", ...)`.

### Option 2 — Direct API (development only)
The app works as-is in the Claude.ai artifact environment where the API
is pre-authenticated. For a standalone deployment you'll need the proxy above.

---

## 📦 Dependencies

| Package | Version | Purpose |
|---|---|---|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM renderer |
| vite | ^5.4.10 | Build tool & dev server |
| @vitejs/plugin-react | ^4.3.1 | React + fast refresh |
| tailwindcss | ^3.4.14 | Utility CSS |
| autoprefixer | ^10.4.20 | CSS browser compat |
| postcss | ^8.4.47 | CSS processor |

No other runtime dependencies. Everything else is vanilla React.

---

## 🗂️ localStorage Keys

| Key | Content |
|---|---|
| `rpt-v4` | Current app data (v4 format) |
| `rpt-v3` | Legacy data (kept, not deleted) |
| `rpt-v2` | Legacy data (kept, not deleted) |
| `rpt-v1` | Legacy data (kept, not deleted) |

---

## 🌙 Features Summary

- **Document Reader** — WPS-style with 4 themes, highlights (5 colours), notes,
  full-text search, auto table of contents, zoom, font controls
- **Homelander AI** — Contextual study companion with full knowledge of your data
- **MCQ Generator** — AI generates MBBS-standard questions from any document
- **Exam Countdown** — Live timers with urgency indicators
- **Analytics** — Time-filtered charts (Today → All Time)
- **Calendar** — Unified view of lectures, assignments, exams
- **Offline-first** — All data in localStorage, works without internet
  (AI features require internet connection)
- **Dark mode** — Light / dark / system preference
