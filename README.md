# VOID / Equity Stress Lab

一個繁體中文、免前端框架的股票壓力估值網站。使用盈餘 × 本益比情境模型：

`模擬股價 = [(基準營收 × (1 + 營收增減率)) × 未來淨利率 ÷ (流通股數 × (1 + 稀釋率))] × 目標本益比`

## 直接使用（不須安裝）

雙擊 `index.html`，在瀏覽器直接使用。初始 NVDA **完全是模型示範數據，不是即時報價或最新財報**。

想要分析其他股票：輸入代號（如 AAPL、AMD、MSFT、TSM），按「分析代號」。未連線 API 時會切換手動模式；填寫股價、流通股數（單位：十億股）、營收與淨利（單位：十億美元），立刻得到結果。可按一鍵情境、滑桿、反推目標價、敏感度矩陣及匯出 CSV。

**重要：** 財報的幣別必須與股價一致。頁面計算預設所有資料都是 USD，不會自動將 TWD、JPY 或其他幣別換算為 USD，若是台股/海外原股請先自行換算。負淨利企業不適合用 P/E。本網站非 DCF，也不計算機率或進行買賣建議。

## 使用 FMP API 自動載入

此網站採用 Financial Modeling Prep (FMP) 的 Stable API（需要自己的 API Key；可用端點依方案而定）。官方文件： https://site.financialmodelingprep.com/developer/docs/quickstart

### 選項 A：Cloudflare Worker（推薦）

1. 建立 FMP 帳戶及 API Key。
2. 先安裝 Cloudflare Wrangler（需要 Node.js），在本資料夾執行 `npx wrangler login`。
3. 執行 `npx wrangler secret put FMP_API_KEY`，貼上你的金鑰。這樣金鑰只會留在 Worker 的 Secret，不會暴露在前端網站檔案中。
4. 執行 `npx wrangler deploy` 部署 `worker.js`；部署輸出會包含 `https://...workers.dev` 網址。
5. 開啟網站，按右上「資料來源」，將 Worker 網址貼入「API 代理網址」，儲存。之後輸入股票代號就能取得行情與最新可用財報。Worker 預設快取五分鐘。
6. 網站可直接部署至 Cloudflare Pages（上傳 `index.html`），或任何靜態網頁主機。

**安全提醒：** 示範 Worker 的 `Access-Control-Allow-Origin: *` 方便本機測試，但對公開服務建議改成你的網站正式網域。CORS 不能真正防止 API 被濫用；正式商用還需要驗證、速率限制、流量控管等措施。FMP 方案也可能對某些股票/財報端點不授權。

### 選項 B：直接輸入 FMP API Key

在「資料來源」視窗貼上自己的 FMP API Key，若未設定 Worker 網址，網站會直接從瀏覽器對 FMP 發出請求。這可能遇到 FMP 的 CORS 政策；瀏覽器會直接接觸 API Key，因此**不建議在共享電腦或公開環境使用**。Key 只放在網頁暫存變數中，不寫入 localStorage。

## 資料口徑

- 股價與市值：FMP `stable/quote`。
- 公司名稱：FMP `stable/profile`。
- 優先使用 `stable/income-statements-ttm` 的最近 12 個月營收、淨利。
- 若 TTM 不可用，嘗試最近四季季報合計；再不可用則退回最新年度財報，並顯示 FY 而非 TTM。
- 股數優先使用市值 ÷ 股價估算（非逐股精確）；如缺少市值，從財報加權平均流通股數推算。
- TTM 與市值時點可能不同，預設無法檢驗幣別轉換；高階分析應再查閱公司原始申報資料。
- 手動輸入後，標示 USER OVERRIDDEN，不再宣稱是原始即時 API 值。

## 驗證

可開啟 `index.html`；在 NVDA 示範資料中，採用營收 -61.8%、淨利率 20%、P/E 10×、0% 稀釋，合理估值約 **12.02 美元**。

## 法律與用途

供研究、教育及情境壓力測試使用，不構成投資建議。結果由使用者假設驅動，不能推論實際股價、確定性或發生機率。

## 發佈至 GitHub Pages

這個專案已包含 `.github/workflows/deploy-pages.yml`，可透過 GitHub Actions 將根目錄的 `index.html` 發佈為公開靜態網站。

1. 在 GitHub 建立儲存庫 `void-equity-stress-lab`，預設分支設為 `main`。
2. 將此專案中的檔案（包含 `.github/workflows/deploy-pages.yml`）上傳至儲存庫根目錄。
3. 進入儲存庫 **Settings → Pages → Build and deployment → Source**，選擇 **GitHub Actions**。
4. 在 **Actions** 分頁確認 `Deploy GitHub Pages` 工作流程完成；首次開啟 Pages 或首次推送後，若沒有自動觸發，可在 Actions 手動選擇 **Run workflow**。
5. 網站網址通常是 `https://<GitHub 使用者名稱>.github.io/void-equity-stress-lab/`。

**重要：** GitHub Pages 只負責發布前端靜態網站，無法安全地替你保存 FMP API Key。若要讓其他使用者只輸入股票代號就自動取得資料，另需部署 Cloudflare Worker，並在 Worker Secret 中設定 `FMP_API_KEY`。請勿把任何真實 API Key、`.env` 或 `.dev.vars` 提交到公開 GitHub。