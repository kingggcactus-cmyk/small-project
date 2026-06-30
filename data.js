const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

const DB_HOST = process.env.DB_HOST || "127.0.0.1";
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER || "mbuser";
const DB_PASSWORD = process.env.DB_PASSWORD || "0975";
const DB_NAME = process.env.DB_NAME || "mom_beauty";

let pool;

async function initDb() {
  // connect without database to ensure DB exists
  const rootConn = await mysql.createConnection({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD });
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await rootConn.end();

  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });

  // create table if not exists
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bookings (
      id VARCHAR(64) PRIMARY KEY,
      date DATE NOT NULL,
      slot VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      contact VARCHAR(255) NOT NULL,
      memo TEXT,
      status VARCHAR(32) NOT NULL,
      createdAt DATETIME NOT NULL
    )
  `);
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/api/bookings", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM bookings");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "取得預約資料失敗" });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    const { id, date, slot, name, contact, memo, status, createdAt } = req.body;
    if (!id || !date || !slot || !name || !contact || !status || !createdAt) {
      return res.status(400).json({ error: "缺少預約必要欄位" });
    }
    await pool.execute(
      `INSERT INTO bookings (id, date, slot, name, contact, memo, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, date, slot, name, contact, memo || "", status, createdAt]
    );
    res.status(201).json(req.body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "新增預約失敗" });
  }
});

app.patch("/api/bookings/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: "缺少狀態欄位" });
    const [result] = await pool.execute("UPDATE bookings SET status = ? WHERE id = ?", [status, id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "找不到預約" });
    res.json({ id, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "更新預約狀態失敗" });
  }
});

app.delete("/api/bookings/cancelled", async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM bookings WHERE status = 'cancelled'");
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "清除已取消預約失敗" });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Mom Beauty 後端伺服器啟動： http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("資料庫初始化失敗：", err);
    process.exit(1);
  });
