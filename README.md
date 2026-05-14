# 股票分析練習紀錄（本機儲存版）

純前端、零後端、可部署至 GitHub Pages 的台股練習紀錄工具。所有資料儲存於瀏覽器 IndexedDB。

> **本機儲存版本：** 所有資料只存在目前瀏覽器的 IndexedDB 中，**不會上傳到伺服器**。清除瀏覽器資料、更換裝置或更換瀏覽器都可能導致資料無法取得。請定期使用「備份匯出」功能保存資料。

## 技術架構

| 層 | 技術 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 6 |
| 樣式 | Tailwind CSS |
| 狀態管理 | React Query |
| 本機儲存 | IndexedDB（透過 `idb`）|
| 圖表 | lightweight-charts |
| 部署 | GitHub Pages（靜態） |

### 股市資料來源（多來源 fallback）

系統依照下列順序自動嘗試取得價格，第一個成功者即被採用：

1. **FinMind**（主，匿名，300 req/hr）— 支援任意日期的歷史日線
2. **TWSE OpenAPI**（上市備援）— 主要供今日 snapshot
3. **TPEx OpenAPI**（上櫃 / 興櫃備援）— 主要供今日 snapshot
4. **手動補價**（最後手段，由 UI 觸發）

每筆價格都會保存來源資訊：providerId / providerName / fetchedAt / actualDate / isFallbackSource / dataSourceNote。

不需要任何 API key、token 或 secret。任何 provider 失敗都會自動嘗試下一個，全部失敗才提示手動補價。

## 本機開發

```bash
cd frontend
npm install
npm run dev
# 開啟 http://localhost:5173
```

## Build / 部署

### 本機 build

```bash
cd frontend
npm run build
# build output：frontend/dist
npm run preview   # 在本機檢視 build 結果
```

### 部署到 GitHub Pages

1. 把 repo 推到 GitHub 並切到 `main` branch。
2. 在 GitHub repo Settings → Pages → Source 選擇 `GitHub Actions`。
3. push 到 `main` 後 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 會自動 build 並部署 `frontend/dist`。

> 本專案的 Vite `base` 設為 `/`，適用於 User/Org Site（`username.github.io`）。若要部署到 Project Site（`username.github.io/repo-name/`），請把 [frontend/vite.config.ts](frontend/vite.config.ts) 的 `base` 改為 `/<repo-name>/`。

## 主要功能

| 功能 | 說明 |
|---|---|
| 今日新增 | 輸入股票代號（如 `2330`），自動透過 dispatcher 抓當日收盤 |
| 待追蹤 | 未滿 5 個交易日的分析，顯示浮動報酬與距離結算日 |
| 一週檢視 | 達 5 個交易日自動取結算價、計算報酬率與成功判定 |
| 後續追蹤 | 已結算的股票持續更新最新價格 |
| 統計儀表板 | 整體 / 區間勝率、平均報酬、最佳 / 最差 |
| 每日紀錄 | 每天的分析筆數、勝率、平均報酬 |
| 個股查詢 | 單一代號的歷史分析與統計 |
| 資料錯誤 | 抓取失敗的紀錄，可重新抓取或手動補價 |
| 備份匯出 | 匯出 / 匯入 JSON、清除本機資料 |
| 資料來源 | 各 provider 的健康狀態，可手動測試連線 |

## 商業邏輯

- **5 交易日結算**：跳過週末與台灣 2026 國定假日；結算當天須過 18:00（台北時間）才允許取結算價
- **每日 3 支上限**：同一天最多新增 3 支股票
- **同日不重複**：同日同代號禁止重複新增
- **價格鎖死**：`analysisPrice` 與 `reviewPrice` 一旦寫入即不可被任何 provider 或編輯動作覆蓋；`latestPrice` 可持續更新並重寫 `latestPriceSource`
- **成功判定**：看多 → 結算價 > 分析價；看空 → 結算價 < 分析價；持平 → 失敗
- **勝率計算**：僅統計 `REVIEWED` 與 `TRACKING` 狀態的紀錄
- **報酬率**：`(comparePrice - analysisPrice) / analysisPrice * 100`，保留 4 位小數
- **非交易日結算**：若結算日為非交易日，自動採用下一個可取得的交易日，並在 `reviewActualDate` 與 `dataSourceNote` 註明

## 備份與還原

1. 進入「備份匯出」頁籤。
2. 點「匯出 JSON」下載備份檔。
3. 還原時上傳同份 JSON，選擇「略過重複」（建議）或「覆寫」策略。
4. 「清除本機資料」需兩階段確認，請務必先匯出。

## 資料儲存說明

- DB 名稱：`stock_analysis_db`（IndexedDB）
- Schema 版本：1，未來改版會走 `onupgradeneeded` migration
- Object stores：
  - `analyses`：所有分析紀錄
  - `settings`：UI 偏好與 autoCheck 時間戳
  - `providerHealth`：各 provider 最近成功 / 失敗時間與計數

## 已知限制

- FinMind 匿名 300 req/hr 為共享配額，重度使用會撞牆，此時改走 TWSE / TPEx（但這兩者僅 snapshot）或手動補價。
- TWSE / TPEx OpenAPI 的歷史日期支援度有限；對任意過去日期可能直接回 `unsupported`。
- 台灣假日表寫死於 [frontend/src/services/tradingDays.ts](frontend/src/services/tradingDays.ts)，每年需依 TWSE 公告手動更新。
- IndexedDB 無跨裝置同步，請以匯出 JSON 作為備份手段。
- 沒有 server background job — 自動結算僅在使用者開站時觸發。

## 專案結構

```
.
├── .github/workflows/deploy.yml   # GitHub Pages 自動部署
└── frontend/                      # React + Vite 前端（部署根目錄）
    ├── src/
    │   ├── api/client.ts          # local-first API 介面（保留舊版簽章）
    │   ├── db/                    # IndexedDB schema、CRUD、備份
    │   ├── providers/             # FinMind / TWSE / TPEx / manual / mock + dispatcher
    │   ├── services/              # tradingDays / analysis / statistics / autoCheck
    │   ├── hooks/                 # React Query hooks（未動）
    │   ├── components/            # UI 元件
    │   └── types/                 # 共用型別
    ├── public/404.html            # SPA fallback（保險）
    └── vite.config.ts             # base='/', 無 server proxy
```
