# ProjectHub

A premium, minimalist **personal project-management platform** for developers,
students and entrepreneurs. Plan projects, run a task board, track bugs, keep
notes, and watch your productivity in analytics — all in a clean, dark-mode-first
interface inspired by Linear, Notion and GitHub Projects.

Built to be **simple to run anywhere — including a Raspberry Pi.**

---

## ✨ Features

- **Dashboard** — active projects, open tasks/bugs, completed tasks, recent
  activity, upcoming deadlines, project progress, productivity chart.
- **Projects** — create/edit/delete, statuses, priorities, progress %, tags
  (with tag filtering), **milestones**, start/due dates, per-project everything.
- **Tasks** — Kanban board with **drag-to-reorder** + list view, subtasks,
  **recurring tasks**, **time tracking** (start/stop timer), **bulk actions**,
  filtering & search, statuses, priorities, due dates.
- **Calendar** — month view of tasks and project deadlines.
- **Bugs** — severity & status, link to projects, reproduction steps, fix notes.
- **Notes** — markdown editor with live preview, **interactive checkboxes**,
  pinning, project or personal.
- **Analytics** — completion rate, weekly throughput, 14-day activity, status
  distributions, open vs resolved bugs.
- **Account** — profile, password change, theme, JSON export/import.
- **UX** — responsive, mobile-friendly, ⌘K command palette with **global
  search**, in-app **reminders**, toast notifications, elegant empty states,
  light/dark themes, installable PWA.

## 🧱 Tech stack

| Layer    | Choice                                           |
| -------- | ------------------------------------------------ |
| Framework| Next.js 14 (App Router) + React 18 + TypeScript  |
| Styling  | Tailwind CSS + shadcn-style UI + Radix primitives|
| Data     | Prisma ORM + **SQLite** (swappable to PostgreSQL)|
| Auth     | NextAuth (credentials, JWT sessions)             |
| Mutations| Server Actions                                   |
| Charts   | Recharts                                         |

### Why SQLite by default?

You asked for something simple to run on a Raspberry Pi. PostgreSQL means a
separate database server to install, configure and keep alive. **SQLite is a
single file** — zero configuration, tiny memory footprint, and rock-solid on
ARM. Because everything goes through Prisma, switching to Postgres later is a
two-line change (see [below](#-switching-to-postgresql)).

---

## 🚀 Quick start (local)

Requires **Node.js 18.18+** (Node 20 LTS recommended).

```bash
# 1. Install dependencies
npm install

# 2. Create the SQLite database + demo data (one command)
npm run setup        # prisma generate + db push + seed

# 3. Run the dev server
npm run dev
```

Open <http://localhost:3000> and sign in with the demo account:

```
Email:    demo@projecthub.local
Password: demo1234
```

> Before anything public, set a real `NEXTAUTH_SECRET` in `.env`
> (`openssl rand -base64 32`).

---

## 🍓 Running on a Raspberry Pi

Tested approach for a Pi 4 / Pi 5 running 64-bit Raspberry Pi OS.

### 1. Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. Get the app onto the Pi & install

```bash
cd projecthub
npm install
```

### 3. Configure environment

Edit `.env` and set a strong secret. If you want to reach the app from other
devices on your network, set `NEXTAUTH_URL` to the Pi's LAN address:

```env
NEXTAUTH_SECRET="<paste output of: openssl rand -base64 32>"
NEXTAUTH_URL="http://192.168.1.50:3000"
```

### 4. Initialise the database & build

```bash
npm run setup     # creates prisma/dev.db and seeds it
npm run build
```

> **Low-memory Pi (1–2 GB)?** The Next.js build can be memory-hungry. Give Node
> more headroom and/or add swap:
>
> ```bash
> NODE_OPTIONS=--max-old-space-size=1024 npm run build
> # optional: temporary 2 GB swap
> sudo dphys-swapfile swapoff && sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile && sudo dphys-swapfile setup && sudo dphys-swapfile swapon
> ```

### 5. Run it

```bash
npm start          # serves on http://0.0.0.0:3000
```

Browse to `http://<pi-ip>:3000` from any device on your network.

### Keep it running (recommended)

**Option A — PM2** (auto-restart, starts on boot):

```bash
sudo npm install -g pm2
pm2 start npm --name projecthub -- start
pm2 save
pm2 startup        # follow the printed instructions
```

**Option B — systemd service** (`/etc/systemd/system/projecthub.service`):

```ini
[Unit]
Description=ProjectHub
After=network.target

[Service]
WorkingDirectory=/home/pi/projecthub
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now projecthub
```

### Automated daily backups

Your whole database is one file (`prisma/dev.db`). A helper script copies it
(using SQLite's safe online `.backup`) and prunes old copies:

```bash
chmod +x scripts/backup-db.sh
crontab -e
# add — runs every day at 3am, keeps the newest 14:
0 3 * * *  /home/pi/projecthub/scripts/backup-db.sh >> /home/pi/projecthub/backups/backup.log 2>&1
```

You can also export/import a portable JSON backup from **Settings → Data &
backup** in the app.

### Health & monitoring

- `GET /api/health` → JSON `{ status, db, uptime }` (200 when healthy, 503 when
  the DB is down) — point an uptime monitor at it.
- `/status` → a simple human-readable status page.

### Install as an app (PWA)

ProjectHub ships a web manifest, generated icons and a service worker, so you
can **Add to Home Screen** on a phone/tablet and launch it full-screen. (Android
Chrome requires HTTPS for full install; iOS Safari works over your LAN.)

### 📲 Telegram bot (account-linked companion)

A premium long-polling bot (no public webhook — perfect behind Tailscale). Each
Telegram chat is linked to one ProjectHub account; unlinked chats can only
`/start`, `/link`, `/help`. Everything else is inline-keyboard driven:
dashboard, guided task creation, task center, projects and search. It also sends
a morning digest and a nightly JSON backup to your chat.

1. Open **@BotFather** → `/newbot` → copy the token. Put it in `.env`:
   ```env
   TELEGRAM_BOT_TOKEN="123456:ABC..."
   ```
2. Run the bot:
   ```bash
   pm2 start bot/bot.mjs --name projecthub-bot && pm2 save
   ```
3. In ProjectHub open **Settings → Telegram → Connect Telegram** to get a code,
   then send it to the bot: `/link ABC123`. Done — the bot now acts as you.

**Using it:** open the bot → tap around the dashboard. Create tasks via the
guided flow (project → title → priority → due → confirm), review **My Tasks**
(Today / Overdue / This week), browse projects, search, and tap **✅ / ⏰** on
any task. Morning digest + nightly backup arrive automatically.

### Minimal footprint (optional)

This project builds with Next.js **standalone output**, so you can run just the
self-contained server without the full `node_modules`:

```bash
node .next/standalone/server.js
# (copy ./public and ./.next/static alongside it if you relocate the folder)
```

---

## 🔁 Switching to PostgreSQL

1. In `prisma/schema.prisma`, change the datasource provider:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. In `.env`, set `DATABASE_URL` to your Postgres connection string.
3. Run `npm run db:push` (and `npm run db:seed` for demo data).

Nothing else changes — the app code is database-agnostic.

---

## 📜 Scripts

| Script              | Description                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Start the dev server                               |
| `npm run build`     | Production build (runs `prisma generate` first)    |
| `npm start`         | Start the production server                        |
| `npm run setup`     | generate + push schema + seed (first-time setup)   |
| `npm run db:push`   | Apply the Prisma schema to the database            |
| `npm run db:seed`   | Seed demo data + demo account                      |
| `npm run db:studio` | Open Prisma Studio to browse the database          |
| `npm run db:reset`  | Reset the database and re-seed                      |

## ⌨️ Keyboard shortcuts

- **⌘K / Ctrl-K** — open the command palette (navigate, create, toggle theme).

## 🗂️ Project structure

```
app/
  (auth)/            # login & register
  (app)/             # authenticated shell (sidebar + topbar)
    dashboard/
    projects/[id]/
    tasks/  bugs/  notes/  analytics/
  api/auth/          # NextAuth route
components/
  ui/                # shadcn-style primitives
  layout/            # sidebar, topbar, command menu
  dashboard/ projects/ tasks/ bugs/ notes/ analytics/
  charts/
lib/
  actions/           # server actions (projects, tasks, bugs, notes, auth)
  constants.ts       # status/priority/severity design system
  data.ts            # dashboard & analytics queries
  auth.ts session.ts prisma.ts markdown.ts
prisma/
  schema.prisma      # 7 entities: User, Project, Task, Subtask, Bug, Note, ActivityLog
  seed.ts
```

---

Made to be calm, fast, and yours. Enjoy shipping. 🚀
