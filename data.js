const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const line = require("@line/bot-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "bookings.db");
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const MOM_USER_ID = process.env.MOM_USER_ID;
// JOYCE_ID 必須是 LINE userId，例如 Uxxxxxxxxxxxxxx，不是 LINE 名稱或 LINE ID
const JOYCE_ID = process.env.JOYCE_ID;

const lineClient = LINE_CHANNEL_ACCESS_TOKEN
  ? new line.Client({ channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN })
  : null;
const lineMiddleware = LINE_CHANNEL_SECRET
  ? line.middleware({ channelSecret: LINE_CHANNEL_SECRET })
  : (req, res, next) => next();

function logLineConfig() {
  console.log("LINE config:");
  console.log("  LINE_CHANNEL_ACCESS_TOKEN:", !!LINE_CHANNEL_ACCESS_TOKEN);
  console.log("  LINE_CHANNEL_SECRET:", !!LINE_CHANNEL_SECRET);
  console.log("  MOM_USER_ID:", !!MOM_USER_ID);
  console.log("  JOYCE_ID:", JOYCE_ID ? JOYCE_ID : "<not set>");
  console.log("  lineClient:", !!lineClient);
  console.log("  lineMiddleware:", LINE_CHANNEL_SECRET ? "enabled" : "noop");
}

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

function saveBooking(booking) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO bookings (id, date, slot, name, contact, memo, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [booking.id, booking.date, booking.slot, booking.name, booking.contact, booking.memo || "", booking.status, booking.createdAt],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.redirect("/mom-beauty-booking.html");
});

app.get("/debug/config", (req, res) => {
  res.json({
    LINE_CHANNEL_ACCESS_TOKEN: !!LINE_CHANNEL_ACCESS_TOKEN,
    LINE_CHANNEL_SECRET: !!LINE_CHANNEL_SECRET,
    MOM_USER_ID: !!MOM_USER_ID,
    JOYCE_ID: JOYCE_ID || null,
    lineClient: !!lineClient,
    lineMiddleware: LINE_CHANNEL_SECRET ? "enabled" : "noop"
  });
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

    await saveBooking(req.body);

    if (lineClient) {
      const pushTasks = [];
      if (JOYCE_ID && JOYCE_ID.startsWith("U")) {
        pushTasks.push(
          lineClient.pushMessage(JOYCE_ID, {
            type: "text",
            text: "🎉 有新的預約！"
          })
        );
      } else if (JOYCE_ID) {
        console.warn("JOYCE_ID looks invalid, must start with 'U':", JOYCE_ID);
      }

      if (LINE_CHANNEL_ACCESS_TOKEN && MOM_USER_ID) {
        const timeText = req.body.time || req.body.slot;
        pushTasks.push(
          lineClient.pushMessage(MOM_USER_ID, {
            type: "text",
            text: `📢 新預約！\n姓名：${req.body.name}\n日期：${req.body.date}\n時間：${timeText}`
          })
        );
      }

      const pushResults = await Promise.allSettled(pushTasks);
      pushResults.forEach((result) => {
        if (result.status === "rejected") {
          console.error("LINE push message failed:", result.reason);
        }
      });
    }

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

// LINE webhook endpoint
app.post(
  "/webhook",
  lineMiddleware,
  async (req, res) => {
    console.log("webhook called:", JSON.stringify(req.body, null, 2));
    const events = (req.body && req.body.events) || [];

    // Process events asynchronously, but acknowledge quickly
    events.forEach((event) => {
      console.log("processing event:", event.type);
      (async () => {
        try {
          if (event.type === "message" && event.message && event.message.type === "text") {
            const text = event.message.text.trim().toLowerCase();
            if (lineClient) {
              if (text === "userid" || text === "user id" || text === "我的 userid") {
                const userId = event.source && event.source.userId;
                await lineClient.replyMessage(event.replyToken, {
                  type: "text",
                  text: userId
                    ? `您的 LINE userId 是：${userId}`
                    : "抱歉，無法取得您的 userId。"
                });
              } else {
                await lineClient.replyMessage(event.replyToken, {
                  type: "text",
                  text: "收到您的訊息，謝謝！"
                });
              }
            }
          } else if (event.type === "follow") {
            if (lineClient) {
              await lineClient.replyMessage(event.replyToken, {
                type: "text",
                text: "謝謝您加入淨美，歡迎預約！"
              });
            }
          }
        } catch (err) {
          console.error("處理 LINE event 失敗：", err);
        }
      })();
    });

    res.status(200).send("OK");
  }
);

initDb()
  .then(() => {
    logLineConfig();
    app.listen(PORT, () => {
      console.log(`Mom Beauty 後端伺服器啟動： http://localhost:${PORT}`);
      console.log(`LINE webhook endpoint: http://localhost:${PORT}/webhook`);
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
