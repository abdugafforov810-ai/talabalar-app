
const express = require("express");
const { Pool } = require("pg");
const crypto = require("node:crypto");

const app = express();

app.disable("x-powered-by");
app.use(express.urlencoded({
  extended: true,
  limit: "10kb"
}));

// =====================================
// 1. ADMINISTRATOR HIMOYASI
// =====================================

function secureEqual(a, b) {
  const hashA = crypto
    .createHash("sha256")
    .update(a)
    .digest();

  const hashB = crypto
    .createHash("sha256")
    .update(b)
    .digest();

  return crypto.timingSafeEqual(hashA, hashB);
}

app.use((req, res, next) => {
  const username = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  res.set("Cache-Control", "no-store");

  if (!username || !password) {
    return res.status(503).send(
      "Administrator sozlamalari tayyor emas."
    );
  }

  const authorization =
    req.get("authorization") || "";

  const match = /^Basic ([A-Za-z0-9+/=]+)$/.exec(
    authorization
  );

  if (match && match[1].length < 8192) {
    const decoded = Buffer.from(
      match[1], "base64"
    ).toString("utf8");

    const index = decoded.indexOf(":");

    if (index !== -1) {
      const user = decoded.slice(0, index);
      const pass = decoded.slice(index + 1);

      if (
        secureEqual(user, username) &&
        secureEqual(pass, password)
      ) {
        return next();
      }
    }
  }

  res.set(
    "WWW-Authenticate",
    'Basic realm="Talabalar Pro", charset="UTF-8"'
  );

  return res.status(401).send(
    "Administrator ruxsati talab qilinadi."
  );
});

// =====================================
// 2. POSTGRESQL MA'LUMOTLAR BAZASI
// =====================================

const url = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: url,
  ssl: url && url.includes("render.com")
    ? { rejectUnauthorized: false }
    : false
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

// =====================================
// 3. MA'LUMOTLARNI XAVFSIZ KO'RSATISH
// =====================================

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
    char => ESC[char]
  );
}

// =====================================
// 4. TALABALAR RO'YXATI
// =====================================

app.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT ism, guruh FROM talabalar ORDER BY id"
    );

    const list = rows.map(student => `
      <li>
        ${esc(student.ism)}
        —
        ${esc(student.guruh || "")}
      </li>
    `).join("");

    res.send(`
      <!doctype html>
      <html lang="uz">
      <head>
        <meta charset="utf-8">
        <meta name="viewport"
              content="width=device-width, initial-scale=1">

        <title>Talabalar Pro 2.0</title>
      </head>

      <body style="
        font-family: Arial, sans-serif;
        background: #f4f6f8;
        padding: 30px;
      ">

        <h1>🎓 Talabalar Pro 2.0</h1>

        <p>Administrator boshqaruv paneli</p>

        <h2>Yangi talaba qo'shish</h2>

        <form method="POST" action="/add">
          <input
            name="ism"
            placeholder="Ism familiya"
            maxlength="100"
            required
          >

          <input
            name="guruh"
            placeholder="Guruh"
            maxlength="50"
          >

          <button type="submit">
            Qo'shish
          </button>
        </form>

        <h2>Talabalar ro'yxati</h2>

        <ul>
          ${list || "<li>Hozircha talabalar yo'q</li>"}
        </ul>

      </body>
      </html>
    `);
  } catch (error) {
    next(error);
  }
});

// =====================================
// 5. YANGI TALABA QO'SHISH
// =====================================

app.post("/add", async (req, res, next) => {
  try {
    const ism = String(req.body.ism || "").trim();
    const guruh = String(req.body.guruh || "").trim();

    if (
      !ism ||
      ism.length > 100 ||
      guruh.length > 50
    ) {
      return res.status(400).send(
        "Kiritilgan ma'lumotlar noto'g'ri."
      );
    }

    await pool.query(
      `INSERT INTO talabalar (ism, guruh)
       VALUES ($1, $2)`,
      [ism, guruh]
    );

    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

// =====================================
// 6. XATOLARNI BOSHQARISH
// =====================================

app.use((err, req, res, next) => {
  console.error("Server xatosi:", err.message);

  res.status(500).send(
    "Serverda xatolik yuz berdi."
  );
});

// =====================================
// 7. SERVERNI ISHGA TUSHIRISH
// =====================================

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `Server ${PORT}-portda ishlayapti`
      );
    });
  })
  .catch(error => {
    console.error(
      "Bazaga ulanish xatosi:",
      error.message
    );

    process.exit(1);
  });
