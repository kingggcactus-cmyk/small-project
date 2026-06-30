# Mom Beauty 預約系統

這是一個使用 Node.js + Express + SQLite 的美容預約系統，包含前端和後端。

## 目錄結構

- `data.js`：後端伺服器，提供靜態檔案和 `/api/bookings` API
- `mom-beauty-booking.html`：顧客預約頁面
- `mom-beauty-admin.html`：管理後台頁面
- `mom-beauty-booking.js`：前端邏輯
- `mom-beauty-booking.css`：樣式
- `bookings.db`：SQLite 資料庫檔案

## 本地啟動

1. 進入專案資料夾：

```bash
cd mom-beauty
```

2. 安裝依賴：

```bash
npm install
```

3. 啟動伺服器：

```bash
npm start
```

4. 開啟瀏覽器

- 客戶預約頁面： `http://localhost:3000/mom-beauty-booking.html`
- 管理後台頁面： `http://localhost:3000/mom-beauty-admin.html`

## Render 部署要點

1. 建立 Render Web Service
2. 選擇 Node.js
3. Root Directory 為 `mom-beauty`
4. Build Command： `npm install`
5. Start Command： `npm start`
6. 預設環境變數：
   - `PORT=3000`

**優點：** SQLite 不需要另外的資料庫服務，Render 免費方案直接支援。

## 注意

- SQLite 資料存在 `bookings.db` 檔案
- Render 上的資料會持久化儲存（在該服務的文件系統內）
- 如果需要備份，可以定期下載 `bookings.db` 檔案
