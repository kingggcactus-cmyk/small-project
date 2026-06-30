# Mom Beauty 預約系統

這是一個使用 Node.js + Express + MySQL 的美容預約系統，包含前端和後端。

## 目錄結構

- `data.js`：後端伺服器，提供靜態檔案和 `/api/bookings` API
- `mom-beauty-booking.html`：顧客預約頁面
- `mom-beauty-admin.html`：管理後台頁面
- `mom-beauty-booking.js`：前端邏輯
- `mom-beauty-booking.css`：樣式

## 本地啟動

1. 進入專案資料夾：

```bash
cd mom-beauty
```

2. 安裝依賴：

```bash
npm install
```

3. 建立 `.env`（參考 `.env.example`）：

```text
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
PORT=3000
```

4. 啟動伺服器：

```bash
npm start
```

5. 開啟瀏覽器

- 客戶預約頁面： `http://localhost:3000/mom-beauty-booking.html`
- 管理後台頁面： `http://localhost:3000/mom-beauty-admin.html`

## Render 部署要點

1. 建立 Render Web Service
2. 選擇 Node.js
3. 如果你的 GitHub repo 不是直接放在根目錄，請設定 Root Directory 為 `mom-beauty`
4. Build Command： `npm install`
5. Start Command： `npm start`
6. 在環境變數中設定：

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `PORT`

## 注意

- 如果你在 Render 上部署，請確保你的 MySQL 是可連線的：
  - 可以使用 Render 的資料庫服務（若支援）
  - 或使用外部可連線的 MySQL
- 不要把 `.env` 上傳到 GitHub，請只保留 `.env.example`
