const db = require('./config/database');

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

async function getActors() {
  const associates = await db.query('SELECT associate_id, user_id FROM "Associate" ORDER BY associate_id ASC LIMIT 50');
  const freelancers = await db.query('SELECT freelancer_id, user_id FROM "Freelancer" WHERE is_approved = true ORDER BY freelancer_id DESC LIMIT 120');
  return { associates: associates.rows, freelancers: freelancers.rows };
}

async function ensureConversation(client, associateId, freelancerId) {
  // Create or fetch conversation between associate and freelancer
  const existing = await client.query(`
    SELECT conversation_id FROM "Conversation"
    WHERE associate_id = $1 AND freelancer_id = $2
    LIMIT 1
  `, [associateId, freelancerId]);
  if (existing.rowCount > 0) return existing.rows[0].conversation_id;
  const res = await client.query(`
    INSERT INTO "Conversation" (associate_id, freelancer_id, created_at, updated_at)
    VALUES ($1, $2, NOW(), NOW())
    RETURNING conversation_id
  `, [associateId, freelancerId]);
  return res.rows[0].conversation_id;
}

async function seedMessages() {
  let client;
  try {
    client = await db.pool.connect();
    console.log('✅ Connected to DB');

    // Optional cleanup of prior demo messages
    console.log('🧹 Cleaning previously seeded demo messages (if any)...');
    await client.query(`DELETE FROM "Message" WHERE content LIKE '[demo_seed]%'`);

    const { associates, freelancers } = await getActors();
    if (associates.length === 0 || freelancers.length === 0) {
      console.log('⚠️ Not enough associates/freelancers to seed messages.');
      return;
    }

    const today = new Date();
    const start = addDays(today, -89);

    await client.query('BEGIN');

    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const convCount = isWeekend ? randInt(0, 2) : randInt(1, 4);
      for (let c = 0; c < convCount; c++) {
        const assoc = associates[randInt(0, associates.length - 1)];
        const free = freelancers[randInt(0, freelancers.length - 1)];
        const conversationId = await ensureConversation(client, assoc.associate_id, free.freelancer_id);

        const msgCount = isWeekend ? randInt(1, 4) : randInt(2, 8);
        for (let m = 0; m < msgCount; m++) {
          const senderIsAssociate = Math.random() < 0.5;
          const senderId = senderIsAssociate ? assoc.user_id : free.user_id;
          const sentAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), randInt(8, 20), randInt(0, 59), randInt(0, 59));
          await client.query(`
            INSERT INTO "Message" (conversation_id, sender_id, content, sent_at, is_delivered)
            VALUES ($1, $2, $3, $4, true)
          `, [conversationId, senderId, `[demo_seed] Hello on ${d.toISOString().split('T')[0]} #${m+1}`, sentAt]);
        }

        // Update conversation timestamp
        await client.query('UPDATE "Conversation" SET updated_at = NOW() WHERE conversation_id = $1', [conversationId]);
      }
    }

    await client.query('COMMIT');
    console.log('🎉 Seeded message trends for last 90 days');

    const verify = await db.query(`
      SELECT COUNT(*) AS messages, COUNT(DISTINCT conversation_id) AS conversations
      FROM "Message"
      WHERE sent_at >= NOW() - INTERVAL '90 days'
    `);
    console.log(`✅ Verification: ${verify.rows[0].messages} messages across ${verify.rows[0].conversations} conversations (90d)`);
  } catch (err) {
    if (client) { try { await client.query('ROLLBACK'); } catch {} }
    console.error('❌ Seeding error:', err);
    process.exit(1);
  } finally {
    if (client) client.release();
    process.exit(0);
  }
}

seedMessages();


