const fs = require("fs");
const path = require("path");
const { CRITERIA, ROLES, PRESENTATIONS } = require("./config");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, "state.json");

function resolveAdminPin(existingPin) {
  if (process.env.ADMIN_PIN && /^\d{4,8}$/.test(process.env.ADMIN_PIN)) {
    return process.env.ADMIN_PIN;
  }
  if (existingPin) return String(existingPin);
  return String(Math.floor(1000 + Math.random() * 9000));
}

function defaultState() {
  return {
    settings: {
      admin_pin: resolveAdminPin(null),
      phase: "open",
      results_revealed: "0",
      active_presentation: "all",
    },
    presentations: PRESENTATIONS.map((p, index) => ({
      id: p.id,
      name: p.name,
      sortOrder: index,
    })),
    voters: [],
    votes: [],
  };
}

function load() {
  let loaded;
  if (!fs.existsSync(dbPath)) {
    loaded = defaultState();
  } else {
    try {
      loaded = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    } catch {
      loaded = defaultState();
    }
  }
  loaded.settings = loaded.settings || {};
  loaded.settings.admin_pin = resolveAdminPin(loaded.settings.admin_pin);
  save(loaded);
  return loaded;
}

function save(state) {
  const temp = `${dbPath}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, dbPath);
}

let state = load();

function persist() {
  save(state);
}

function getSetting(key) {
  return state.settings[key] ?? null;
}

function setSetting(key, value) {
  state.settings[key] = String(value);
  persist();
}

function listPresentations() {
  return state.presentations
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ id: p.id, name: p.name, sortOrder: p.sortOrder }));
}

function updatePresentationName(id, name) {
  const presentation = state.presentations.find((p) => p.id === id);
  if (!presentation) {
    throw Object.assign(new Error("Presentation not found"), { status: 404 });
  }
  presentation.name = name;
  persist();
}

function countVotersByRole() {
  const counts = Object.fromEntries(ROLES.map((r) => [r.id, 0]));
  for (const voter of state.voters) {
    counts[voter.role] = (counts[voter.role] || 0) + 1;
  }
  return counts;
}

function getVoter(id) {
  return state.voters.find((v) => v.id === id) || null;
}

function createVoter({ id, role, displayName }) {
  const roleConfig = ROLES.find((r) => r.id === role);
  if (!roleConfig) {
    throw Object.assign(new Error("Invalid role"), { status: 400 });
  }
  const counts = countVotersByRole();
  if (counts[role] >= roleConfig.quota) {
    throw Object.assign(
      new Error(`${roleConfig.label} quota is full (${roleConfig.quota})`),
      { status: 409 }
    );
  }
  const voter = {
    id,
    role,
    displayName: displayName || null,
    createdAt: new Date().toISOString(),
  };
  state.voters.push(voter);
  persist();
  return voter;
}

function getVoteForVoter(voterId) {
  return state.votes.find((v) => v.voterId === voterId) || null;
}

function upsertVote({ id, voterId, scores }) {
  const existing = getVoteForVoter(voterId);
  const now = new Date().toISOString();
  if (existing) {
    existing.scores = scores;
    existing.createdAt = now;
    persist();
    return existing;
  }
  const vote = { id, voterId, scores, createdAt: now };
  state.votes.push(vote);
  persist();
  return vote;
}

function listVotesWithVoters() {
  return state.votes.map((vote) => {
    const voter = getVoter(vote.voterId);
    return {
      ...vote,
      role: voter?.role,
      displayName: voter?.displayName,
    };
  });
}

function resetVotesAndVoters() {
  state.votes = [];
  state.voters = [];
  state.settings.results_revealed = "0";
  state.settings.phase = "open";
  persist();
}

function weightedAverage(roleAverages) {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const role of ROLES) {
    const average = roleAverages[role.id];
    if (typeof average !== "number") continue;
    weightedSum += average * role.weight;
    weightTotal += role.weight;
  }
  if (weightTotal === 0) return null;
  return Number((weightedSum / weightTotal).toFixed(2));
}

function computeResults() {
  const presentations = listPresentations();
  const votes = listVotesWithVoters();
  const roleCounts = countVotersByRole();
  const totalQuota = ROLES.reduce((sum, r) => sum + r.quota, 0);

  const byPresentation = {};
  for (const p of presentations) {
    byPresentation[p.id] = {
      presentationId: p.id,
      name: p.name,
      criteria: Object.fromEntries(
        CRITERIA.map((c) => [
          c.id,
          { sum: 0, count: 0, average: null, byRole: {} },
        ])
      ),
      overallAverage: null,
      voteCount: 0,
    };
    for (const c of CRITERIA) {
      for (const r of ROLES) {
        byPresentation[p.id].criteria[c.id].byRole[r.id] = {
          sum: 0,
          count: 0,
          average: null,
        };
      }
    }
  }

  for (const vote of votes) {
    for (const p of presentations) {
      const presentationScores = vote.scores[p.id];
      if (!presentationScores) continue;
      let presentationHasScore = false;
      for (const c of CRITERIA) {
        const value = presentationScores[c.id];
        if (typeof value !== "number") continue;
        presentationHasScore = true;
        const bucket = byPresentation[p.id].criteria[c.id];
        bucket.sum += value;
        bucket.count += 1;
        if (vote.role && bucket.byRole[vote.role]) {
          bucket.byRole[vote.role].sum += value;
          bucket.byRole[vote.role].count += 1;
        }
      }
      if (presentationHasScore) {
        byPresentation[p.id].voteCount += 1;
      }
    }
  }

  for (const p of presentations) {
    const entry = byPresentation[p.id];
    const criterionAverages = [];
    for (const c of CRITERIA) {
      const bucket = entry.criteria[c.id];
      const roleAverages = {};
      for (const r of ROLES) {
        const roleBucket = bucket.byRole[r.id];
        roleBucket.average =
          roleBucket.count > 0
            ? Number((roleBucket.sum / roleBucket.count).toFixed(2))
            : null;
        if (roleBucket.average != null) {
          roleAverages[r.id] = roleBucket.average;
        }
      }
      // Final criterion score = weighted mix of role averages (normalized by
      // weights of roles that actually voted, so results stay on the 1–5 scale).
      bucket.average = weightedAverage(roleAverages);
      if (bucket.average != null) criterionAverages.push(bucket.average);
    }
    entry.overallAverage =
      criterionAverages.length > 0
        ? Number(
            (
              criterionAverages.reduce((sum, value) => sum + value, 0) /
              criterionAverages.length
            ).toFixed(2)
          )
        : null;
  }

  const ranking = presentations
    .map((p) => byPresentation[p.id])
    .slice()
    .sort((a, b) => (b.overallAverage ?? -1) - (a.overallAverage ?? -1));

  return {
    voteCount: votes.length,
    voterCount: Object.values(roleCounts).reduce((a, b) => a + b, 0),
    totalQuota,
    roleCounts,
    roleQuotas: Object.fromEntries(ROLES.map((r) => [r.id, r.quota])),
    roleWeights: Object.fromEntries(ROLES.map((r) => [r.id, r.weight])),
    presentations: presentations.map((p) => byPresentation[p.id]),
    ranking,
  };
}

module.exports = {
  getSetting,
  setSetting,
  listPresentations,
  updatePresentationName,
  countVotersByRole,
  getVoter,
  createVoter,
  getVoteForVoter,
  upsertVote,
  listVotesWithVoters,
  resetVotesAndVoters,
  computeResults,
};
