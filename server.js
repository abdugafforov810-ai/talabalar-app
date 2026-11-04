
const express = require("express");
const { Pool } = require("pg");
const crypto = require("node:crypto");

const app = express();
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false, limit: "10kb" }));

// 1. Administrator himoyasi
function secureEqual(a, b) {
  const hash = s => crypto.createHash("sha256")
    .update(String(s)).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
}

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");

  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  if (!user || !password) {
    return res.status(503).send("Admin sozlamalari mavjud emas");
  }

  const auth = req.get("authorization") || "";
  const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(auth);

  if (match && match[1].length < 8192) {
    const decoded = Buffer.from(match[1], "base64")
      .toString("utf8");
    const pos = decoded.indexOf(":");

    if (pos !== -1 &&
        secureEqual(decoded.slice(0, pos), user) &&
        secureEqual(decoded.slice(pos + 1), password)) {
      return next();
    }
  }

  res.set("WWW-Authenticate", 'Basic realm="Talabalar Pro"');
  return res.status(401).send("Administrator ruxsati kerak");
});

// 2. PostgreSQL (Render Internal Database URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS talabalar (
      id SERIAL PRIMARY KEY,
      ism TEXT NOT NULL,
      guruh TEXT,
      qoshilgan TIMESTAMP DEFAULT NOW()
    )
  `);
}

const ESC = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ESC[c]);
}

// 3. Professional Dashboard
app.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim().slice(0, 80);

    const [statsResult, studentsResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS jami,
          COUNT(DISTINCT NULLIF(TRIM(guruh), ''))::int
            AS guruhlar
        FROM talabalar
      `),
      pool.query(`
        SELECT ism, guruh
        FROM talabalar
        WHERE ism ILIKE $1
           OR COALESCE(guruh, '') ILIKE $1
        ORDER BY id DESC
        LIMIT 100
      `, ["%" + q + "%"])
    ]);

    const stats = statsResult.rows[0];
    const students = studentsResult.rows;

    const tableRows = students.length
      ? students.map((s, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${esc(s.ism)}</strong></td>
            <td><span class="tag">${esc(s.guruh || "—")}</span></td>
            <td><span class="active">Faol</span></td>
          </tr>
        `).join("")
      : `<tr><td colspan="4" class="empty">
           Talabalar topilmadi
         </td></tr>`;

    res.send(`
<!doctype html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Talabalar Pro 3.0</title>
<style>
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f7fc;
  color: #17233a;
}
.layout {
  display: grid;
  grid-template-columns: 240px minmax(0,1fr);
  min-height: 100vh;
}
.sidebar {
  background: #12223e;
  color: white;
  padding: 28px 18px;
}
.brand {
  font-size: 23px;
  font-weight: bold;
  margin-bottom: 42px;
}
.nav {
  display: block;
  color: #bdcbe2;
  text-decoration: none;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 8px;
}
.nav:hover, .nav.selected {
  background: #29466e;
  color: white;
}
.content {
  padding: 35px;
  width: 100%;
  max-width: 1450px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
}
h1 { margin: 8px 0; font-size: 30px; }
.subtitle { color: #64748b; }
.admin {
  background: white;
  border-radius: 30px;
  padding: 12px 18px;
  font-size: 14px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 18px;
  margin-bottom: 25px;
}
.card, .panel {
  background: white;
  border: 1px solid #e6eaf2;
  border-radius: 16px;
  box-shadow: 0 4px 18px #17233a0a;
}
.card { padding: 25px; }
.card .label { color: #64748b; font-size: 14px; }
.card .number {
  font-size: 34px;
  font-weight: bold;
  margin-top: 12px;
  color: #2558ae;
}
.panel {
  padding: 25px;
  margin-bottom: 22px;
}
.panel h2 { margin-top: 0; font-size: 21px; }
.form-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
input {
  min-width: 0;
  flex: 1;
  padding: 13px 15px;
  border: 1px solid #d5ddea;
  border-radius: 9px;
  font: inherit;
}
input:focus {
  outline: 2px solid #9bbcfb;
  outline-offset: 1px;
}
button {
  background: #2563eb;
  border: 0;
  color: white;
  padding: 13px 22px;
  border-radius: 9px;
  font: inherit;
  cursor: pointer;
}
button:hover { background: #1d4ed8; }
.table-wrap { overflow-x: auto; }
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 18px;
}
th, td {
  padding: 16px 12px;
  text-align: left;
  border-bottom: 1px solid #edf0f5;
}
th {
  background: #f8faff;
  color: #64748b;
  font-size: 13px;
}
.tag {
  background: #e8f0ff;
  color: #2853a5;
  padding: 7px 11px;
  border-radius: 20px;
}
.active { color: #16803c; font-weight: bold; }
.empty { text-align: center; color: #64748b; }
.note { color: #64748b; font-size: 13px; }

@media (max-width: 850px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar { padding: 18px; }
  .brand { margin-bottom: 12px; }
  .nav { display: inline-block; padding: 10px; }
  .content { padding: 16px; }
  .stats { grid-template-columns: 1fr; }
  .header { align-items: flex-start; }
  h1 { font-size: 25px; }
}
@media (max-width: 500px) {
  .admin { display: none; }
  .form-row { flex-direction: column; }
}
</style>
</head>

<body>
<div class="layout">
  <aside class="sidebar">
    <div class="brand">🎓 Talabalar Pro</div>
    <a class="nav selected" href="/">📊 Dashboard</a>
    <a class="nav" href="#talabalar">👨‍🎓 Talabalar</a>
    <a class="nav" href="#qoshish">➕ Yangi talaba</a>
  </aside>

  <main class="content">
    <header class="header">
      <div>
        <p class="subtitle">TA'LIM BOSHQARUV TIZIMI</p>
        <h1>Dashboard</h1>
        <p class="subtitle">
          Talabalar Pro 3.0 boshqaruv paneli
        </p>
      </div>
      <div class="admin">🔐 Administrator</div>
    </header>

    <section class="stats">
      <div class="card">
        <div class="label">👨‍🎓 Jami talabalar</div>
        <div class="number">${stats.jami}</div>
      </div>
      <div class="card">
        <div class="label">🏫 Guruhlar soni</div>
        <div class="number">${stats.guruhlar}</div>
      </div>
      <div class="card">
        <div class="label">📋 Ko'rsatilmoqda</div>
        <div class="number">${students.length}</div>
      </div>
    </section>

    <section class="panel" id="qoshish">
      <h2>➕ Yangi talaba qo'shish</h2>
      <form action="/add" method="POST" class="form-row">
        <input name="ism" placeholder="Ism familiya"
               maxlength="100" required>
        <input name="guruh" placeholder="Guruh"
               maxlength="50">
        <button type="submit">Qo'shish</button>
      </form>
    </section>

    <section class="panel" id="talabalar">
      <h2>👨‍🎓 Talabalar ro'yxati</h2>

      <form method="GET" action="/" class="form-row">
        <input name="q" value="${esc(q)}"
               placeholder="Ism yoki guruh bo'yicha qidirish">
        <button type="submit">Qidirish</button>
      </form>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Ism familiya</th>
              <th>Guruh</th>
              <th>Holat</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <p class="note">
        Bir vaqtning o'zida eng ko'pi bilan 100 ta yozuv
        ko'rsatiladi.
      </p>
    </section>
  </main>
</div>
</body>
</html>`);
  } catch (err) {
    next(err);
  }
});

// 4. Talaba qo'shish
app.post("/add", async (req, res, next) => {
  try {
    const origin = req.get("origin");
    if (req.get("sec-fetch-site") === "cross-site" ||
        (origin && new URL(origin).host !== req.get("host"))) {
      return res.status(403).send("Ruxsat berilmadi");
    }

    const ism = typeof req.body.ism === "string"
      ? req.body.ism.trim() : "";
    const guruh = typeof req.body.guruh === "string"
      ? req.body.guruh.trim() : "";

    if (!ism || ism.length > 100 || guruh.length > 50) {
      return res.status(400).send("Ma'lumot noto'g'ri");
    }

    await pool.query(
      "INSERT INTO talabalar (ism,guruh) VALUES ($1,$2)",
      [ism, guruh]
    );

    res.redirect("/#talabalar");
  } catch (err) {
    next(err);
  }
});

// 5. Server xatolari
app.use((err, req, res, next) => {
  console.error("Server xatosi:", err.message);
  res.status(500).send("Serverda xatolik yuz berdi");
});

// 6. Ishga tushirish
const PORT = process.env.PORT || 3000;

init()
  .then(() => app.listen(PORT, () =>
    console.log(`Server ${PORT}-portda ishlayapti`)
  ))
  .catch(err => {
    console.error("Database xatosi:", err.message);
    process.exit(1);
  });
