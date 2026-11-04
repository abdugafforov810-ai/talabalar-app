
const express = require("express");
const { Pool } = require("pg");
const crypto = require("node:crypto");

const app = express();

app.disable("x-powered-by");
app.use(express.urlencoded({
  extended: false,
  limit: "10kb"
}));

// 1. ADMINISTRATOR HIMOYASI

function secureEqual(a, b) {
  const hash = s => crypto
    .createHash("sha256")
    .update(String(s))
    .digest();

  return crypto.timingSafeEqual(hash(a), hash(b));
}

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");

  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  if (!user || !password) {
    return res.status(503).send(
      "Admin sozlamalari mavjud emas"
    );
  }

  const auth = req.get("authorization") || "";
  const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(auth);

  if (match && match[1].length < 8192) {
    const decoded = Buffer.from(
      match[1], "base64"
    ).toString("utf8");

    const pos = decoded.indexOf(":");

    if (
      pos !== -1 &&
      secureEqual(decoded.slice(0, pos), user) &&
      secureEqual(decoded.slice(pos + 1), password)
    ) {
      return next();
    }
  }

  res.set(
    "WWW-Authenticate",
    'Basic realm="Talabalar Pro"'
  );

  return res.status(401).send(
    "Administrator ruxsati kerak"
  );
});

// 2. POSTGRESQL MA'LUMOTLAR BAZASI

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

// 3. XAVFSIZ HTML

const ESC = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    c => ESC[c]
  );
}

// 4. TALABALAR PRO 4.0 DASHBOARD

app.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string"
      ? req.query.q.trim().slice(0, 80)
      : "";

    const [statsResult, studentsResult] =
      await Promise.all([
        pool.query(`
          SELECT
            COUNT(*)::int AS jami,
            COUNT(
              DISTINCT NULLIF(TRIM(guruh), '')
            )::int AS guruhlar
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
            <td>
              <strong>${esc(s.ism)}</strong>
            </td>
            <td>
              <span class="tag">
                ${esc(s.guruh || "—")}
              </span>
            </td>
            <td>
              <span class="active">● Faol</span>
            </td>
          </tr>
        `).join("")
      : `
        <tr>
          <td colspan="4" class="empty">
            Talabalar topilmadi
          </td>
        </tr>
      `;

    res.send(`
<!doctype html>
<html lang="uz">

<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width, initial-scale=1">

<title>Talabalar Pro 4.0</title>

<style>

/* ASOSIY DIZAYN */

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Segoe UI", Arial, sans-serif;
  background: #f1f5fb;
  color: #17233a;
}

.layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 100vh;
}

/* PREMIUM SIDEBAR */

.sidebar {
  background: linear-gradient(
    180deg,
    #0b1730,
    #192e56
  );
  color: white;
  padding: 28px 18px;
  box-shadow: 4px 0 24px rgba(0,0,0,.08);
}

.brand {
  font-size: 24px;
  font-weight: bold;
  letter-spacing: -.5px;
  margin-bottom: 42px;
}

.nav {
  display: block;
  color: #bdcbe2;
  text-decoration: none;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 8px;
  transition: background .2s, transform .2s;
}

.nav:hover {
  transform: translateX(4px);
  background: #304b7a;
  color: white;
}

.nav.selected {
  background: #29466e;
  color: white;
}

/* ASOSIY SAHIFA */

.content {
  padding: 40px;
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

h1 {
  margin: 8px 0;
  font-size: 34px;
  letter-spacing: -1px;
  color: #14213b;
}

.subtitle {
  color: #64748b;
}

.admin {
  background: white;
  border: 1px solid #e3eaf5;
  border-radius: 30px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 600;
}

/* STATISTIKA KARTOCHKALARI */

.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
  margin-bottom: 25px;
}

.card,
.panel {
  background: white;
  border: 1px solid #e6eaf2;
  border-radius: 20px;
  box-shadow: 0 4px 18px #17233a0a;
}

.card {
  position: relative;
  overflow: hidden;
  padding: 30px;
  transition: transform .2s, box-shadow .2s;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 14px 35px rgba(20,40,80,.12);
}

.card::before {
  content: "";
  display: block;
  width: 45px;
  height: 5px;
  border-radius: 20px;
  background: #4f78fa;
  margin-bottom: 20px;
}

.card:nth-child(2)::before {
  background: #16b8a6;
}

.card:nth-child(3)::before {
  background: #a46bf2;
}

.card .label {
  color: #64748b;
  font-size: 14px;
}

.card .number {
  font-size: 40px;
  font-weight: bold;
  margin-top: 12px;
  color: #172b54;
}

/* PANELLAR */

.panel {
  padding: 30px;
  margin-bottom: 22px;
}

.panel h2 {
  margin-top: 0;
  font-size: 21px;
}

.form-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* INPUTLAR */

input {
  min-width: 0;
  flex: 1;
  padding: 13px 15px;
  background: #f8faff;
  border: 1px solid #d5ddea;
  border-radius: 9px;
  font: inherit;
  transition: border-color .2s;
}

input:focus {
  outline: 2px solid #9bbcfb;
  outline-offset: 1px;
  border-color: #4277f5;
  background: white;
}

/* TUGMALAR */

button {
  background: #2563eb;
  border: 0;
  color: white;
  padding: 13px 22px;
  border-radius: 9px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(37,99,235,.18);
  transition: transform .2s, background .2s;
}

button:hover {
  background: #1d4ed8;
  transform: translateY(-2px);
}

/* TALABALAR JADVALI */

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 18px;
}

th,
td {
  padding: 16px 12px;
  text-align: left;
  border-bottom: 1px solid #edf0f5;
}

th {
  background: #f8faff;
  color: #64748b;
  font-size: 13px;
}

tbody tr:hover {
  background: #f1f6ff;
}

.tag {
  display: inline-block;
  background: #e8f0ff;
  color: #2853a5;
  padding: 7px 11px;
  border-radius: 20px;
}

.active {
  color: #16803c;
  font-weight: bold;
}

.empty {
  text-align: center;
  color: #64748b;
}

.note {
  color: #64748b;
  font-size: 13px;
}

/* TELEFON VA PLANSHET */

@media (max-width: 850px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    padding: 18px;
  }

  .brand {
    margin-bottom: 12px;
  }

  .nav {
    display: inline-block;
    padding: 10px;
  }

  .content {
    padding: 18px;
  }

  .stats {
    grid-template-columns: 1fr;
  }

  .card,
  .panel {
    padding: 20px;
  }

  .header {
    align-items: flex-start;
  }

  h1 {
    font-size: 28px;
  }
}

@media (max-width: 500px) {
  .admin {
    display: none;
  }

  .form-row {
    flex-direction: column;
  }
}

</style>
</head>

<body>

<div class="layout">

  <aside class="sidebar">
    <div class="brand">
      🎓 Talabalar Pro
    </div>

    <a class="nav selected" href="/">
      📊 Dashboard
    </a>

    <a class="nav" href="#talabalar">
      👨‍🎓 Talabalar
    </a>

    <a class="nav" href="#qoshish">
      ➕ Yangi talaba
    </a>
  </aside>

  <main class="content">

    <header class="header">
      <div>
        <p class="subtitle">
          TA'LIM BOSHQARUV TIZIMI
        </p>

        <h1>Dashboard</h1>

        <p class="subtitle">
          Talabalar Pro 4.0 boshqaruv paneli
        </p>
      </div>

      <div class="admin">
        🔐 Administrator
      </div>
    </header>

    <section class="stats">

      <div class="card">
        <div class="label">
          👨‍🎓 Jami talabalar
        </div>
        <div class="number">
          ${stats.jami}
        </div>
      </div>

      <div class="card">
        <div class="label">
          🏫 Guruhlar soni
        </div>
        <div class="number">
          ${stats.guruhlar}
        </div>
      </div>

      <div class="card">
        <div class="label">
          📋 Ko'rsatilmoqda
        </div>
        <div class="number">
          ${students.length}
        </div>
      </div>

    </section>

    <section class="panel" id="qoshish">

      <h2>➕ Yangi talaba qo'shish</h2>

      <form action="/add"
            method="POST"
            class="form-row">

        <input
          name="ism"
          placeholder="Ism familiya"
          maxlength="100"
          aria-label="Ism familiya"
          required>

        <input
          name="guruh"
          placeholder="Guruh"
          maxlength="50"
          aria-label="Guruh">

        <button type="submit">
          Qo'shish
        </button>

      </form>
    </section>

    <section class="panel" id="talabalar">

      <h2>👨‍🎓 Talabalar ro'yxati</h2>

      <form method="GET"
            action="/"
            class="form-row">

        <input
          name="q"
          value="${esc(q)}"
          placeholder="Ism yoki guruh bo'yicha qidirish"
          aria-label="Talabalarni qidirish">

        <button type="submit">
          Qidirish
        </button>

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

          <tbody>
            ${tableRows}
          </tbody>

        </table>
      </div>

      <p class="note">
        Bir vaqtning o'zida eng ko'pi bilan
        100 ta yozuv ko'rsatiladi.
      </p>

    </section>

  </main>
</div>

</body>
</html>
    `);

  } catch (err) {
    next(err);
  }
});

// 5. TALABA QO'SHISH

app.post("/add", async (req, res, next) => {
  try {
    const origin = req.get("origin");

    if (
      req.get("sec-fetch-site") === "cross-site" ||
      (origin && new URL(origin).host !== req.get("host"))
    ) {
      return res.status(403).send(
        "Ruxsat berilmadi"
      );
    }

    const ism = typeof req.body.ism === "string"
      ? req.body.ism.trim()
      : "";

    const guruh = typeof req.body.guruh === "string"
      ? req.body.guruh.trim()
      : "";

    if (
      !ism ||
      ism.length > 100 ||
      guruh.length > 50
    ) {
      return res.status(400).send(
        "Ma'lumot noto'g'ri"
      );
    }

    await pool.query(
      `INSERT INTO talabalar (ism, guruh)
       VALUES ($1, $2)`,
      [ism, guruh]
    );

    res.redirect("/#talabalar");

  } catch (err) {
    next(err);
  }
});

// 6. SERVER XATOLARI

app.use((err, req, res, next) => {
  console.error("Server xatosi:", err.message);

  res.status(500).send(
    "Serverda xatolik yuz berdi"
  );
});

// 7. SERVERNI ISHGA TUSHIRISH

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `Talabalar Pro 4.0 ${PORT}-portda ishlayapti`
      );
    });
  })
  .catch(err => {
    console.error(
      "Database xatosi:",
      err.message
    );

    process.exit(1);
  });
