# Ex Cartiera Live Vote

Live multi-criteria scoring for four presentations during a university lecture.

## Roles & quotas

- 28 students (weight 0.4)
- 5 teaching (weight 0.7)
- 5 Cartiera staff (weight 1.0)

Everyone scores all four presentations on four criteria (1–5).
Final scores average within each role, then combine with the weights above
(normalized so results stay on the 1–5 scale).

## Screens

| URL | Purpose |
| --- | --- |
| `/` | Home + QR code |
| `/vote.html` | Phone ballot |
| `/display.html` | Projector live counters + final charts |
| `/criteria.html` | Criteria board for the second screen |
| `/admin.html` | Open/close voting, rename groups, reveal leaderboard |

## Local run

```bash
npm install
npm start
```

Open http://localhost:3000 — the admin PIN is printed in the terminal.

## Deploy (Render)

1. Push this repo to GitHub.
2. Create a **Web Service** (Node) with:
   - Build: `npm install`
   - Start: `npm start`
   - Region: Frankfurt (or closest)
3. Optional: set `DATA_DIR=/var/data` and attach a disk if you need persistence across restarts.

Free Render services sleep after idle time — open the URL a few minutes before the lecture.

## Event flow

1. Open `/display.html` on the projector and `/criteria.html` on the second screen.
2. Show `/` (or the QR image) so people can join.
3. Let everyone vote after each pitch (or all at the end).
4. In Admin → **Reveal results** for per-criterion bars + overall ranking.
