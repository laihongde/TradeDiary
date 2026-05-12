# Copilot Handoff — 股票分析練習紀錄 local-first 版

## 目前專案狀態

這個專案原本是 FastAPI + PostgreSQL + React 架構，已由 Claude Code 改成純前端 local-first 版本。

目前架構：

- Frontend：React + TypeScript + Vite
- Storage：IndexedDB
- Hosting：GitHub Pages static deploy
- No backend runtime
- No PostgreSQL
- No Python server
- No secret API key

目前已完成：

- IndexedDB 資料層
- export/import JSON 備份
- provider fallback：FinMind → TWSE → TPEx → Manual
- LocalOnlyNotice
- BackupPage
- DataSourceStatus
- ManualPriceModal
- GitHub Pages workflow
- `.env` 已移除並加入 `.gitignore`
- `npm run build` 已通過
- 已建立第一個 commit：`3fea378 feat: v1 local-first 純前端版`

## 重要不可破壞規則

請不要破壞以下設計：

1. 不要重新引入 backend、PostgreSQL、FastAPI、Prisma 或 server proxy。
2. 不要把 API key、token、secret 放到前端。
3. 不要移除 IndexedDB local-first 架構。
4. 不要改壞 provider fallback：
   - FinMindProvider
   - TWSEProvider
   - TPExProvider
   - ManualPriceProvider
5. 不要改壞 GitHub Pages 靜態部署。
6. 不要覆蓋已鎖定價格：
   - analysisPrice 一旦存在，不可被覆蓋
   - reviewPrice 一旦存在，不可被覆蓋
   - latestPrice 可以更新
7. 不要破壞 export/import JSON。
8. 不要破壞每日最多 3 支股票限制。
9. 不要破壞同日同股票不可重複新增。
10. build 必須通過。

## 目前主要缺口

目前系統仍然固定使用 5 個交易日作為追蹤週期。

例如目前 `frontend/src/services/tradingDays.ts` 有：

```ts
export const REVIEW_TRADING_DAYS = 5;
```
