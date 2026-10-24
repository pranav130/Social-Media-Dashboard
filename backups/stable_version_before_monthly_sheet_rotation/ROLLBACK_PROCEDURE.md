# UPPCL Dashboard — Rollback Procedure to Previous Stable Version

**Stable Version Label:** Stable Version – Before Monthly Sheet Rotation  
**Original Google Spreadsheet ID:** `10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY`  
**Original Worksheet GID:** `598922870` (`Twitter Complaint List`)  
**Webhook URL:** `https://script.google.com/macros/s/AKfycbx3uJpVaB33ss8jGnmfArBpDXBc4o-pQ6fsD0x-FggDWRT1_pWEHNPDUWKpf5uG0B6HCQ/exec`  
**Baseline Verified Record Count:** 5,829 rows  

---

## 1. Quick In-Dashboard Administrator Rollback

If sheet rotation needs to be rolled back to this stable version:
1. Log in to the UPPCL Dashboard as **Super Administrator** (`admin` or administrative account).
2. Navigate to **Administration -> Google Sheets Rotation & Archive**.
3. Under **Emergency Controls / Rollback**, click **"Restore Stable Spreadsheet Configuration"**.
4. Confirm the prompt: Target Spreadsheet ID `10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY`, GID `598922870`.
5. The system performs an immediate verification check, points all reads and writes back to `10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY`, clears in-memory caches, and resynchronizes.

---

## 2. Server Deployment / Filesystem Rollback

If code files need to be restored to their pre-rotation state:
1. Stop the Node.js server.
2. Copy files from `backups/stable_version_before_monthly_sheet_rotation/` back to the root directory:
   - `server.js`
   - `working_sheet_service.js`
   - `google_sheets_service.js`
   - `sheet_mapper.js`
   - `sheets-sync.js`
   - `db.js`
   - `google_apps_script/Code.gs`
   - `public/js/app.js`
3. Restart the server (`npm start`).
4. Run `npm test` to verify all 136 baseline tests pass.

---

## 3. Data Protection Guarantee During Rollback

- The new monthly spreadsheets and Google Drive archives are NEVER deleted during rollback.
- All complaint edits made during any period are preserved in SQLite audit logs and in the respective Google Sheets.
- The original Google Sheet `10_210Ynr_F0Pj1Yov_pqjVZ1kaYIEWrbGF1jn16sgNY` is strictly preserved and never overwritten or renamed.
