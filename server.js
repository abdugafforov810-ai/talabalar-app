
const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.urlencoded({ extended: true }));

// Render beradigan ulanish manzili
const url = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: url,
  ssl: url && url.includes("render.com")
    ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS
  talabalar (
    id SERIAL PRIMARY KEY,
    ism TEXT NOT NULL,
    guruh TEXT,
    qoshilgan TIMESTAMP DEFAULT NOW()
  )`);
}

const ESC = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
};

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ESC[c]);

app.get("/", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT ism, guruh FROM talabalar ORDER BY id"
  );

  const list = rows.map((r) =>
    `<li>${esc(r.ism)} — ${esc(r.guruh || "")}</li>`
  ).join("");

  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Talabalar ro'yxati</title>
</head>
<body style="font-family:sans-serif;margin:40px">
  <h1>Talabalar ro'yxati</h1>
  <form method="POST" action="/add">
    <input name="ism" placeholder="Ism familiya" required>
    <input name="guruh" placeholder="Guruh">
    <button>Qo'shish</button>
  </form>
  <ul>${list}</ul>
</body>
</html>`);
});

app.post("/add", async (req, res) => {
  await pool.query(
    "INSERT INTO talabalar (ism, guruh) VALUES ($1, $2)",
    [req.body.ism, req.body.guruh]
  );
  res.redirect("/");
});

const PORT = process.env.PORT || 3000;

init().then(() => app.listen(PORT, () =>
  console.log(`Server ${PORT}-portda ishlayapti, jadval tayyor`)
));
