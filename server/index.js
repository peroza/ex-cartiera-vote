const path = require("path");
const express = require("express");
const cors = require("cors");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const {
  CRITERIA,
  ROLES,
  SCORE_MIN,
  SCORE_MAX,
} = require("./config");
const store = require("./db");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json({ limit: "256kb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

const sseClients = new Set();

function broadcast(event, payload) {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    res.write(data);
  }
}

function publicState() {
  const results = store.computeResults();
  const revealed = store.getSetting("results_revealed") === "1";
  return {
    phase: store.getSetting("phase"),
    resultsRevealed: revealed,
    activePresentation: store.getSetting("active_presentation"),
    presentations: store.listPresentations(),
    criteria: CRITERIA,
    roles: ROLES,
    scoreMin: SCORE_MIN,
    scoreMax: SCORE_MAX,
    progress: {
      voteCount: results.voteCount,
      voterCount: results.voterCount,
      totalQuota: results.totalQuota,
      roleCounts: results.roleCounts,
      roleQuotas: results.roleQuotas,
    },
    results: revealed
      ? {
          presentations: results.presentations,
          ranking: results.ranking,
        }
      : null,
    live: revealed
      ? null
      : {
          // During voting: counts only, no ranking averages
          presentations: results.presentations.map((p) => ({
            presentationId: p.presentationId,
            name: p.name,
            voteCount: p.voteCount,
          })),
        },
  };
}

function requireAdmin(req, res, next) {
  const pin = req.header("x-admin-pin") || req.body?.adminPin;
  if (!pin || pin !== store.getSetting("admin_pin")) {
    return res.status(401).json({ error: "Invalid admin PIN" });
  }
  return next();
}

function validateScores(scores, presentations) {
  if (!scores || typeof scores !== "object") {
    return "Scores object is required";
  }
  for (const p of presentations) {
    const block = scores[p.id];
    if (!block || typeof block !== "object") {
      return `Missing scores for ${p.name}`;
    }
    for (const c of CRITERIA) {
      const value = block[c.id];
      if (!Number.isInteger(value) || value < SCORE_MIN || value > SCORE_MAX) {
        return `Score for ${p.name} / ${c.short} must be an integer ${SCORE_MIN}-${SCORE_MAX}`;
      }
    }
  }
  return null;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/state", (_req, res) => {
  res.json(publicState());
});

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`event: state\ndata: ${JSON.stringify(publicState())}\n\n`);
  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
});

app.get("/api/qr", async (req, res) => {
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host");
  const target = `${proto}://${host}/vote.html`;
  try {
    const png = await QRCode.toBuffer(target, {
      type: "png",
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.send(png);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/voters", (req, res) => {
  try {
    if (store.getSetting("phase") === "closed") {
      return res.status(403).json({ error: "Voting is closed" });
    }
    const { role, displayName } = req.body || {};
    const voter = store.createVoter({
      id: uuidv4(),
      role,
      displayName: typeof displayName === "string" ? displayName.trim() : "",
    });
    broadcast("state", publicState());
    res.status(201).json({ voter });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.get("/api/voters/:id", (req, res) => {
  const voter = store.getVoter(req.params.id);
  if (!voter) return res.status(404).json({ error: "Voter not found" });
  const vote = store.getVoteForVoter(voter.id);
  res.json({ voter, vote });
});

app.post("/api/votes", (req, res) => {
  try {
    if (store.getSetting("phase") === "closed") {
      return res.status(403).json({ error: "Voting is closed" });
    }
    const { voterId, scores } = req.body || {};
    const voter = store.getVoter(voterId);
    if (!voter) return res.status(404).json({ error: "Voter not found" });

    const presentations = store.listPresentations();
    const validationError = validateScores(scores, presentations);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const vote = store.upsertVote({
      id: uuidv4(),
      voterId,
      scores,
    });
    broadcast("state", publicState());
    res.json({ vote });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/admin/login", (req, res) => {
  const pin = req.body?.adminPin;
  if (!pin || pin !== store.getSetting("admin_pin")) {
    return res.status(401).json({ error: "Invalid admin PIN" });
  }
  res.json({
    ok: true,
    adminPin: pin,
    state: publicState(),
  });
});

app.get("/api/admin/bootstrap", requireAdmin, (_req, res) => {
  res.json({
    adminPin: store.getSetting("admin_pin"),
    state: publicState(),
  });
});

app.post("/api/admin/phase", requireAdmin, (req, res) => {
  const phase = req.body?.phase;
  if (!["open", "closed"].includes(phase)) {
    return res.status(400).json({ error: "phase must be open or closed" });
  }
  store.setSetting("phase", phase);
  broadcast("state", publicState());
  res.json({ ok: true, state: publicState() });
});

app.post("/api/admin/reveal", requireAdmin, (req, res) => {
  const revealed = Boolean(req.body?.revealed);
  store.setSetting("results_revealed", revealed ? "1" : "0");
  broadcast("state", publicState());
  res.json({ ok: true, state: publicState() });
});

app.post("/api/admin/active-presentation", requireAdmin, (req, res) => {
  const value = req.body?.activePresentation || "all";
  store.setSetting("active_presentation", value);
  broadcast("state", publicState());
  res.json({ ok: true, state: publicState() });
});

app.post("/api/admin/presentations", requireAdmin, (req, res) => {
  const updates = req.body?.presentations;
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: "presentations array required" });
  }
  for (const item of updates) {
    if (!item?.id || typeof item.name !== "string" || !item.name.trim()) {
      return res.status(400).json({ error: "Each presentation needs id and name" });
    }
    store.updatePresentationName(item.id, item.name.trim());
  }
  broadcast("state", publicState());
  res.json({ ok: true, state: publicState() });
});

app.post("/api/admin/reset", requireAdmin, (_req, res) => {
  store.resetVotesAndVoters();
  broadcast("state", publicState());
  res.json({ ok: true, state: publicState() });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (req.path.includes(".")) return next();
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Ex Cartiera vote listening on http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Admin PIN: ${store.getSetting("admin_pin")}`);
});
