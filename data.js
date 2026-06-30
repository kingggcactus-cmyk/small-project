const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "bookings.db");

let db;

async function initDb() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY,
          date TEXT NOT NULL,
          slot TEXT NOT NULL,
          name TEXT NOT NULL,
          contact TEXT NOT NULL,
          memo TEXT,
          status TEXT NOT NULL,
          createdAt TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.redirect("/mom-beauty-booking.html");
});

app.get("/api/bookings", async (req, res) => {
  try {
    db.all("SELECT * FROM bookings", (err, rows) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "取得預約資料失敗" });
      } else {
        res.json(rows || []);
      }
    });
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
    db.run(
      `INSERT INTO bookings (id, date, slot, name, contact, memo, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, date, slot, name, contact, memo || "", status, createdAt],
      (err) => {
        if (err) {
          console.error(err);
          res.status(500).json({ error: "新增預約失敗" });
        } else {
          res.status(201).json(req.body);
        }
      }
    );
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
    db.run("UPDATE bookings SET status = ? WHERE id = ?", [status, id], function(err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "更新預約狀態失敗" });
      } else if (this.changes === 0) {
        res.status(404).json({ error: "找不到預約" });
      } else {
        res.json({ id, status });
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "更新預約狀態失敗" });
  }
});

app.delete("/api/bookings/cancelled", async (req, res) => {
  try {
    db.run("DELETE FROM bookings WHERE status = 'cancelled'", function(err) {
      if (err) {
        console.error(err);
        res.status(500).json({ error: "清除已取消預約失敗" });
      } else {
        res.json({ deleted: this.changes });
      }
    });
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

process.on("SIGINT", () => {
  db.close((err) => {
    if (err) console.error(err);
    process.exit(0);
  });
});
