const db = require('../db');

async function purge() {
  await db.initDb();
  console.log('[Purge] DB initialized');
  const countBefore = db.get("SELECT COUNT(*) as cnt FROM complaints WHERE created_by = 'X_INGESTION_WORKER';");
  console.log('[Purge] Complaints with created_by = X_INGESTION_WORKER before purge:', countBefore?.cnt || 0);

  const res = db.run("DELETE FROM complaints WHERE created_by = 'X_INGESTION_WORKER';");
  db.saveToDiskSync();
  console.log('[Purge] Deleted rows:', res?.changes || 0);

  const countAfter = db.get("SELECT COUNT(*) as cnt FROM complaints WHERE created_by = 'X_INGESTION_WORKER';");
  console.log('[Purge] Complaints with created_by = X_INGESTION_WORKER after purge:', countAfter?.cnt || 0);

  const checkZenith = db.get("SELECT complaint_no, consumer_handle, received_at FROM complaints WHERE consumer_handle = '@Expresszenith77';");
  console.log('[Purge] Zenith check:', checkZenith);
}

purge().catch(console.error);
