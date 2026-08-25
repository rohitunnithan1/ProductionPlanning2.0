# PDI Production Dashboard

A Next.js dashboard for tracking vehicle production PDI numbers, deployed on Vercel.

## Architecture

```
Google Sheets (PDI_Database tab)
   ↑ synced by Apps Script (daily auto-refresh)
   ↓ published as CSV (public read-only)
Vercel App (this repo)
   → fetches CSV → computes stats → renders dashboard
```

## Setup Guide

### Step 1 — Import your Excel to Google Sheets

1. Open [sheets.google.com](https://sheets.google.com)
2. Go to **File > Import > Upload** and select your PDI Sign Off Log Excel file
3. Choose "Replace spreadsheet" and import

### Step 2 — Add the Apps Script

1. In Google Sheets go to **Extensions > Apps Script**
2. Delete any existing code in the editor
3. Paste the contents of `PDI_Database_Script.gs` (in the same folder as this README)
4. Click **Save** (disk icon)
5. Run `buildPDIDatabase` by clicking the ▶ Run button — authorize when prompted
6. You should see a new "PDI_Database" sheet appear with all August 2026 data
7. Optionally run `createDailyTrigger` to auto-refresh the database daily at 6 AM

### Step 3 — Publish the database sheet as CSV

1. In Google Sheets, go to **File > Share > Publish to web**
2. First dropdown: select **PDI_Database**
3. Second dropdown: select **Comma-separated values (.csv)**
4. Click **Publish** and copy the URL
5. It looks like: `https://docs.google.com/spreadsheets/d/XXXXX/pub?gid=YYYYY&single=true&output=csv`

### Step 4 — Deploy to Vercel

```bash
# Clone or push this folder to a GitHub repo, then:
npx vercel

# When prompted for environment variables, add:
# SHEETS_CSV_URL = <the URL from Step 3>
```

Or via the Vercel dashboard:
1. Import the GitHub repo
2. Go to **Settings > Environment Variables**
3. Add `SHEETS_CSV_URL` = your CSV URL
4. Redeploy

### Adding future months

When you start a new month's sheet (e.g. `SEP26 Prod`):

1. Open Apps Script
2. Find the `MONTHLY_SHEETS` array near the top
3. Uncomment or add the new entry:
   ```js
   { name: 'SEP26 Prod', label: 'Sep 2026', headerRow: 1, dataRow: 2 },
   ```
4. Run `buildPDIDatabase` again

The dashboard will automatically show a month selector once multiple months exist.

## Local Development

```bash
npm install
cp .env.example .env.local
# Edit .env.local and add your SHEETS_CSV_URL
npm run dev
# Open http://localhost:3000
```

## What the dashboard shows

| Metric | Description |
|--------|-------------|
| Total Produced | Count of VINs in PDI_Database for the selected month |
| PDI Signed Off | Vehicles where PDI Sign-off Date is filled |
| Pending PDI | Vehicles awaiting sign-off |
| With Issues | Vehicles where PDI Remarks ≠ "All QC OK" |
| Daily Output chart | Bar chart of vehicles produced + PDI'd per date |
| Latest Vehicles | Last 10 entries with VIN, dates, and status |

## Coming soon (future phases)

- Missing parts breakdown (parsed from PDI Remarks)
- Logistics export view
- Month-over-month comparison
- Per-model analytics
