const db = require('../db');

(async () => {
  await db.initDb();

  db.run("UPDATE complaints SET uppcl_replied = 1 WHERE uppcllko_replied = 'YES';");
  db.run("UPDATE complaints SET uppcl_replied = 0 WHERE uppcllko_replied = 'NO';");
  db.saveToDiskSync();

  const groups = db.query(`
    SELECT 
      CASE 
        WHEN category_name = 'APPRECIATION' OR complaint_type = 'APPRECIATION' THEN 'APPRECIATION'
        WHEN uppcl_replied = 1 OR uppcllko_replied = 'YES' THEN 'YES'
        ELSE 'NO'
      END as effective_picked,
      COUNT(*) as c 
    FROM complaints
    GROUP BY effective_picked;
  `);
  console.log('Effective Picked Cards:');
  console.table(groups);
})();
