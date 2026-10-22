const db = require('../db');
(async () => {
  await db.initDb();
  console.log('--- complaint_replies columns ---');
  console.log(db.query('PRAGMA table_info(complaint_replies);').map(c => c.name));
  
  console.log('--- complaints columns related to reply or time ---');
  console.log(db.query('PRAGMA table_info(complaints);').map(c => c.name).filter(n => n.includes('reply') || n.includes('time') || n.includes('at') || n.includes('date')));
  
  const sampleReplies = db.query('SELECT * FROM complaint_replies LIMIT 3;');
  console.log('Sample complaint_replies:', JSON.stringify(sampleReplies, null, 2));

  const sampleComplaintsWithReplies = db.query(`
    SELECT id, complaint_no, received_at, created_at, post_created_at_utc, first_replied_at, uppcl_replied, uppcllko_replied, reply_within_30_min, reply_evidence 
    FROM complaints 
    WHERE uppcl_replied = 1 
    LIMIT 3;
  `);
  console.log('Sample complaints with uppcl_replied=1:', JSON.stringify(sampleComplaintsWithReplies, null, 2));
})();
