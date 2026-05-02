import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, createReadStream } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const dataDir = resolve(__dirname, "data");
const storePath = resolve(dataDir, "store.json");
const outboxPath = resolve(dataDir, "email-outbox.json");
const publicDir = resolve(__dirname, "public");
const distDir = resolve(__dirname, "dist");
const PORT = Number(process.env.PORT || 3001);
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const RESET_TTL_MS = 1000 * 60 * 30;
const TEMP_PASSWORD = "CleanCar1!";

const defaultSites = [
  { id: "olympus-pines", name: "Olympus Pines" },
  { id: "sunset-grove", name: "Sunset Grove" },
  { id: "TX07", name: "TX07" },
  { id: "TX399", name: "TX399" },
  { id: "TX417", name: "TX417" },
  { id: "TX428", name: "TX428" },
  { id: "TX431", name: "TX431" },
  { id: "TX432", name: "TX432" },
];

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function createSeedStore() {
  const now = new Date().toISOString();
  return {
    sites: defaultSites,
    users: [
      {
        id: 1,
        name: "Khary Butler",
        role: "Regional Leader",
        group: "Regional",
        siteId: "ALL",
        email: "",
        passwordHash: hashPassword(TEMP_PASSWORD),
        resetRequired: true,
        createdAt: now,
      },
      {
        id: 2,
        name: "Chandler Ward",
        role: "Regional Ops Leader",
        group: "Regional",
        siteId: "ALL",
        email: "",
        passwordHash: hashPassword(TEMP_PASSWORD),
        resetRequired: true,
        createdAt: now,
      },
      {
        id: 3,
        name: "Adreana Khemlani",
        role: "Site Lead",
        group: "Leadership",
        siteId: "olympus-pines",
        email: "",
        passwordHash: hashPassword(TEMP_PASSWORD),
        resetRequired: true,
        createdAt: now,
      },
      {
        id: 4,
        name: "Sebastian Pachas",
        role: "Assistant Site Leader",
        group: "Leadership",
        siteId: "olympus-pines",
        email: "",
        passwordHash: hashPassword(TEMP_PASSWORD),
        resetRequired: true,
        createdAt: now,
      },
      {
        id: 5,
        name: "Marcus Rodriguez",
        role: "Assistant Site Leader",
        group: "Leadership",
        siteId: "olympus-pines",
        email: "",
        passwordHash: hashPassword(TEMP_PASSWORD),
        resetRequired: true,
        createdAt: now,
      },
      ...["TX07", "TX399", "TX417", "TX428", "TX431", "TX432"].map((siteId, index) => ({
        id: 10 + index,
        name: siteId,
        role: "Site Lead",
        group: "Leadership",
        siteId,
        email: "",
        passwordHash: hashPassword(TEMP_PASSWORD),
        resetRequired: true,
        createdAt: now,
      })),
    ],
    sessions: [],
    passwordResets: [],
  };
}

function ensureDataFiles() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(storePath)) writeFileSync(storePath, JSON.stringify(createSeedStore(), null, 2));
  if (!existsSync(outboxPath)) writeFileSync(outboxPath, JSON.stringify([], null, 2));
}

function readStore() {
  ensureDataFiles();
  return JSON.parse(readFileSync(storePath, "utf8"));
}

function writeStore(store) {
  writeFileSync(storePath, JSON.stringify(store, null, 2));
}

function readOutbox() {
  ensureDataFiles();
  return JSON.parse(readFileSync(outboxPath, "utf8"));
}

function writeOutbox(outbox) {
  writeFileSync(outboxPath, JSON.stringify(outbox, null, 2));
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    group: user.group,
    siteId: user.siteId,
    email: user.email,
    resetRequired: user.resetRequired,
  };
}

function json(res, status, payload, cookies = []) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  if (cookies.length) res.setHeader("Set-Cookie", cookies);
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      if (!raw) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch (error) {
        rejectBody(error);
      }
    });
  });
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function getSessionUser(req, store) {
  const cookies = parseCookies(req);
  const token = cookies.trackops_session;
  if (!token) return null;
  const session = store.sessions.find((item) => item.token === token && Date.now() < item.expiresAt);
  if (!session) return null;
  return store.users.find((user) => user.id === session.userId) || null;
}

function requireAuth(req, res, store) {
  const user = getSessionUser(req, store);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return null;
  }
  return user;
}

function canManageSite(adminUser, siteId) {
  return adminUser.siteId === "ALL" || adminUser.siteId === siteId;
}

function createSession(userId, store) {
  const token = randomBytes(24).toString("hex");
  store.sessions = store.sessions.filter((item) => Date.now() < item.expiresAt);
  store.sessions.push({ token, userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function sessionCookie(token) {
  return `trackops_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; SameSite=Strict`;
}

function clearSessionCookie() {
  return "trackops_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict";
}

function groupForRole(role) {
  if (role.includes("Regional")) return "Regional";
  if (role === "Wash Tech") return "Wash Techs";
  return "Leadership";
}

function handleStatic(req, res) {
  const requestedPath = req.url === "/" ? "/index.html" : req.url;
  const cleanPath = requestedPath.split("?")[0];
  const candidates = [join(distDir, cleanPath), join(publicDir, cleanPath)];
  const filePath = candidates.find((path) => existsSync(path) && statSync(path).isFile());
  const fallbackPath = existsSync(join(distDir, "index.html")) ? join(distDir, "index.html") : join(__dirname, "index.html");
  const finalPath = filePath || fallbackPath;
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
  };
  res.statusCode = 200;
  res.setHeader("Content-Type", contentTypes[extname(finalPath)] || "application/octet-stream");
  createReadStream(finalPath).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const store = readStore();

  if (url.pathname === "/api/bootstrap" && req.method === "GET") {
    json(res, 200, {
      sites: store.sites,
      loginAccounts: store.users.map((user) => ({
        name: user.name,
        role: user.role,
        siteId: user.siteId,
      })),
      tempPasswordHint: "Temporary accounts are seeded with CleanCar1! and require a reset.",
    });
    return;
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const body = await parseBody(req).catch(() => null);
    if (!body) {
      json(res, 400, { error: "Invalid request body." });
      return;
    }
    const user = store.users.find((item) => item.name === body.name);
    if (!user || !verifyPassword(body.password || "", user.passwordHash)) {
      json(res, 401, { error: "Invalid credentials." });
      return;
    }
    if (user.siteId === "ALL") {
      if (body.siteId !== "ALL") {
        json(res, 403, { error: "Regional accounts must use the regional login scope." });
        return;
      }
    } else if (user.siteId !== body.siteId) {
      json(res, 403, { error: "This account is limited to its assigned site." });
      return;
    }
    const token = createSession(user.id, store);
    writeStore(store);
    json(res, 200, { user: sanitizeUser(user) }, [sessionCookie(token)]);
    return;
  }

  if (url.pathname === "/api/auth/session" && req.method === "GET") {
    const user = getSessionUser(req, store);
    if (!user) {
      json(res, 200, { user: null });
      return;
    }
    json(res, 200, { user: sanitizeUser(user), sites: store.sites, users: store.users.map(sanitizeUser) });
    return;
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    const cookies = parseCookies(req);
    store.sessions = store.sessions.filter((item) => item.token !== cookies.trackops_session);
    writeStore(store);
    json(res, 200, { success: true }, [clearSessionCookie()]);
    return;
  }

  if (url.pathname === "/api/auth/request-password-reset" && req.method === "POST") {
    const user = requireAuth(req, res, store);
    if (!user) return;
    const body = await parseBody(req).catch(() => null);
    if (!body || !body.email) {
      json(res, 400, { error: "Email is required." });
      return;
    }
    const token = randomBytes(20).toString("hex");
    store.passwordResets = store.passwordResets.filter((item) => item.userId !== user.id || Date.now() < item.expiresAt);
    store.passwordResets.push({
      userId: user.id,
      token,
      expiresAt: Date.now() + RESET_TTL_MS,
    });
    const targetUser = store.users.find((item) => item.id === user.id);
    targetUser.email = body.email;
    writeStore(store);
    const outbox = readOutbox();
    outbox.unshift({
      to: body.email,
      subject: "TrackOps Password Reset",
      body: `Use this token to reset your TrackOps password: ${token}`,
      createdAt: new Date().toISOString(),
      user: user.name,
    });
    writeOutbox(outbox);
    json(res, 200, {
      success: true,
      developmentResetToken: process.env.NODE_ENV === "production" ? undefined : token,
      message: "Password reset email queued.",
    });
    return;
  }

  if (url.pathname === "/api/auth/complete-password-reset" && req.method === "POST") {
    const body = await parseBody(req).catch(() => null);
    if (!body || !body.name || !body.token || !body.newPassword) {
      json(res, 400, { error: "Name, token, and new password are required." });
      return;
    }
    if (String(body.newPassword).length < 10) {
      json(res, 400, { error: "New password must be at least 10 characters." });
      return;
    }
    const user = store.users.find((item) => item.name === body.name);
    if (!user) {
      json(res, 404, { error: "User not found." });
      return;
    }
    const resetEntry = store.passwordResets.find((item) => item.userId === user.id && item.token === body.token && Date.now() < item.expiresAt);
    if (!resetEntry) {
      json(res, 400, { error: "Reset token is invalid or expired." });
      return;
    }
    user.passwordHash = hashPassword(body.newPassword);
    user.resetRequired = false;
    store.passwordResets = store.passwordResets.filter((item) => item !== resetEntry);
    writeStore(store);
    json(res, 200, { success: true });
    return;
  }

  if (url.pathname === "/api/admin/users" && req.method === "GET") {
    const user = requireAuth(req, res, store);
    if (!user) return;
    if (!canAccessAdminPage(user)) {
      json(res, 403, { error: "Forbidden" });
      return;
    }
    const visibleUsers = user.siteId === "ALL" ? store.users : store.users.filter((item) => item.siteId === user.siteId);
    json(res, 200, { users: visibleUsers.map(sanitizeUser), sites: store.sites });
    return;
  }

  if (url.pathname === "/api/admin/users" && req.method === "POST") {
    const adminUser = requireAuth(req, res, store);
    if (!adminUser) return;
    if (!canAccessAdminPage(adminUser)) {
      json(res, 403, { error: "Forbidden" });
      return;
    }
    const body = await parseBody(req).catch(() => null);
    if (!body || !body.name || !body.role || !body.siteId) {
      json(res, 400, { error: "Missing required fields." });
      return;
    }
    const roleSiteId = body.role.includes("Regional") ? "ALL" : body.siteId;
    if (!canManageSite(adminUser, roleSiteId) && roleSiteId !== "ALL") {
      json(res, 403, { error: "You cannot create users for another site." });
      return;
    }
    if (String(body.password || "").length < 10) {
      json(res, 400, { error: "Password must be at least 10 characters." });
      return;
    }
    const newUser = {
      id: Date.now(),
      name: body.name.trim(),
      role: body.role,
      group: groupForRole(body.role),
      siteId: roleSiteId,
      email: body.email || "",
      passwordHash: hashPassword(body.password),
      resetRequired: true,
      createdAt: new Date().toISOString(),
    };
    store.users.push(newUser);
    writeStore(store);
    json(res, 201, { user: sanitizeUser(newUser) });
    return;
  }

  if (url.pathname.startsWith("/api/admin/users/") && req.method === "DELETE") {
    const adminUser = requireAuth(req, res, store);
    if (!adminUser) return;
    if (!canAccessAdminPage(adminUser)) {
      json(res, 403, { error: "Forbidden" });
      return;
    }
    const id = Number(url.pathname.split("/").pop());
    const target = store.users.find((user) => user.id === id);
    if (!target) {
      json(res, 404, { error: "User not found." });
      return;
    }
    if (target.id === adminUser.id) {
      json(res, 400, { error: "You cannot remove your own account." });
      return;
    }
    if (!canManageSite(adminUser, target.siteId) && target.siteId !== "ALL") {
      json(res, 403, { error: "You cannot remove users from another site." });
      return;
    }
    store.users = store.users.filter((user) => user.id !== id);
    writeStore(store);
    json(res, 200, { success: true });
    return;
  }

  handleStatic(req, res);
});

server.listen(PORT, () => {
  ensureDataFiles();
  console.log(`TrackOps server running on http://localhost:${PORT}`);
});
