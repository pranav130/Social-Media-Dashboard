/**
 * UPPCL Grievance Command Centre - Real X (Twitter) API Integration Service
 * Implements official X API v2 integration, checkpointing, deduplication,
 * rate limit handling, bilingual reply dispatch, and automation safeguards.
 */

const https = require('https');
const crypto = require('crypto');
const db = require('./db');
const { Classifier } = require('./classifier');
const { isPostEligible, resolvePrimaryMonitoredAccount, getMatchedTargetHandles } = require('./eligibility');

class XService {
  /**
   * Get current configuration & credentials securely (secrets masked)
   */
  static getConfig() {
    const getSetting = (k, def = '') => {
      const row = db.get('SELECT value FROM system_settings WHERE key = ?;', [k]);
      return (row && row.value !== undefined) ? row.value : def;
    };

    const cleanStr = (val) => {
      if (!val || typeof val !== 'string') return '';
      return val.trim().replace(/^["']|["']$/g, '');
    };

    const apiKey = cleanStr(process.env.X_API_KEY || getSetting('x_api_key', ''));
    const apiSecret = cleanStr(process.env.X_API_SECRET || getSetting('x_api_secret', ''));
    const bearerToken = cleanStr(process.env.X_BEARER_TOKEN || getSetting('x_bearer_token', ''));
    const accessToken = cleanStr(process.env.X_ACCESS_TOKEN || getSetting('x_access_token', ''));
    const accessSecret = cleanStr(process.env.X_ACCESS_TOKEN_SECRET || getSetting('x_access_token_secret', ''));

    const accountHandle = getSetting('x_account_handle', '@UPPCLLKO');
    const accountId = getSetting('x_account_id', '108658826');
    const connectionStatus = getSetting('x_connection_status', 'Needs Configuration');
    const automationMode = getSetting('automation_mode', 'Mode A - Monitor Only');
    const emergencyStop = getSetting('emergency_stop', 'false') === 'true';
    const lastSyncAt = getSetting('x_last_sync_at', 'Never');
    const lastSyncStatus = getSetting('x_last_sync_status', 'Idle');
    const sinceId = getSetting('x_since_id', '');

    return {
      apiKey,
      apiSecret,
      bearerToken,
      accessToken,
      accessSecret,
      accountHandle,
      accountId,
      connectionStatus,
      automationMode,
      emergencyStop,
      lastSyncAt,
      lastSyncStatus,
      sinceId,
      hasBearerToken: Boolean(bearerToken && bearerToken.length > 20),
      hasOAuthCredentials: Boolean(apiKey && apiSecret && accessToken && accessSecret)
    };
  }

  /**
   * Update configuration & credentials safely
   */
  static updateConfig(updates, updatedBy = 'Super Administrator') {
    const allowedKeys = [
      'x_api_key', 'x_api_secret', 'x_bearer_token', 'x_client_id', 'x_client_secret',
      'x_access_token', 'x_access_token_secret', 'x_account_handle', 'x_account_id',
      'automation_mode', 'emergency_stop', 'ingestion_interval_seconds'
    ];

    for (const [k, v] of Object.entries(updates)) {
      if (allowedKeys.includes(k) && v !== undefined) {
        db.run(`
          INSERT INTO system_settings (key, value, description, updated_at)
          VALUES (?, ?, 'Updated via Admin Console', datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
        `, [k, String(v).trim()]);
      }
    }

    // Auto-update connection status based on credentials
    const cfg = this.getConfig();
    let newStatus = 'Needs Configuration';
    if (cfg.hasBearerToken || cfg.hasOAuthCredentials) {
      newStatus = 'Connected';
    }
    db.run(`
      INSERT INTO system_settings (key, value, description, updated_at)
      VALUES ('x_connection_status', ?, 'Auto-evaluated connection state', datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
    `, [newStatus]);

    db.flush();
    return this.getStatus();
  }

  /**
   * Get public connection status safe for UI rendering (no plaintext tokens)
   */
  /**
   * Get public connection status safe for UI rendering (no plaintext tokens)
   */
  static getStatus() {
    const cfg = this.getConfig();
    let incomingCount = 0;
    let outgoingCount = 0;
    try {
      const inRow = db.get('SELECT COUNT(*) as c FROM x_incoming_posts;');
      if (inRow) incomingCount = inRow.c;
      const outRow = db.get('SELECT COUNT(*) as c FROM x_outgoing_replies;');
      if (outRow) outgoingCount = outRow.c;
    } catch(e) {}

    let modeCode = 'A';
    if (cfg.automationMode.includes('B')) modeCode = 'B';
    else if (cfg.automationMode.includes('C')) modeCode = 'C';

    return {
      account_handle: cfg.accountHandle,
      account_id: cfg.accountId,
      connection_status: cfg.hasBearerToken ? 'Connected' : 'Needs Configuration',
      automation_mode: modeCode,
      full_automation_mode: cfg.automationMode,
      emergency_stop: cfg.emergencyStop,
      has_bearer_token: cfg.hasBearerToken,
      has_user_oauth: cfg.hasOAuthCredentials,
      has_oauth_keys: cfg.hasOAuthCredentials,
      monitored_account: cfg.accountHandle,
      last_sync_at: cfg.lastSyncAt,
      last_sync_status: cfg.lastSyncStatus,
      last_poll_at: cfg.lastSyncAt,
      since_id: cfg.sinceId,
      incoming_posts_count: incomingCount,
      outgoing_replies_count: outgoingCount,
      monitored_handles: [
        '@UPPCLLKO', '@EMofficeUP', '@AKSharmaOffice', '@aksharmaBharat', '@mduppcl'
      ]
    };
  }

  /**
   * Render approved template with complaint placeholders
   */
  static renderTemplate(templateBody, complaint = {}) {
    if (!templateBody) return '';
    const discomHandleMap = {
      'PUVVNL': '@PuVVNLHQ',
      'MVVNL': '@MVVNLHQ',
      'DVVNL': '@dvvnlhq',
      'PVVNL': '@PVVNLHQ',
      'KESCo': '@KESCoHQ'
    };
    const discom = complaint.discom_name || 'UPPCL';
    const discomHandle = discomHandleMap[discom.toUpperCase()] || '@UPPCLLKO';
    
    return templateBody
      .replace(/{COMPLAINT_NO}/gi, complaint.complaint_no || 'UPPCL-SMC-SAMPLE')
      .replace(/{CONSUMER_NAME}/gi, complaint.consumer_name || 'Consumer')
      .replace(/{DISTRICT}/gi, complaint.district_name || 'Uttar Pradesh')
      .replace(/{DISCOM}/gi, discom)
      .replace(/{DISCOM_HANDLE}/gi, discomHandle)
      .replace(/{CATEGORY}/gi, complaint.category_name || 'Power Supply')
      .replace(/{SLA_HOURS}/gi, complaint.sla_hours || '72')
      .replace(/{complaint_no}/g, complaint.complaint_no || 'UPPCL-SMC-SAMPLE')
      .replace(/{consumer_name}/g, complaint.consumer_name || 'Consumer')
      .replace(/{district}/g, complaint.district_name || 'Uttar Pradesh')
      .replace(/{discom}/g, discom)
      .replace(/{sla_hours}/g, complaint.sla_hours || '72');
  }

  /**
   * Make HTTPS request helper
   */
  static makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = body ? JSON.parse(body) : {};
          } catch (e) {
            parsed = { raw: body };
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (postData) {
        req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
      }
      req.end();
    });
  }

  /**
   * RFC 5849 OAuth 1.0a Authorization Header Generator (HMAC-SHA1)
   */
  static generateOAuth1Header(method, url, apiKey, apiSecret, accessToken, accessSecret, extraParams = {}) {
    const oauthParams = {
      oauth_consumer_key: apiKey,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0',
      ...extraParams
    };

    const percentEncode = (str) => {
      return encodeURIComponent(String(str)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    };

    const sortedKeys = Object.keys(oauthParams).sort();
    const paramString = sortedKeys
      .map(k => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
      .join('&');

    const baseString = [
      method.toUpperCase(),
      percentEncode(url),
      percentEncode(paramString)
    ].join('&');

    const signingKey = `${percentEncode(apiSecret)}&${percentEncode(accessSecret)}`;
    const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
    oauthParams.oauth_signature = signature;

    return 'OAuth ' + Object.keys(oauthParams)
      .filter(k => k.startsWith('oauth_'))
      .sort()
      .map(k => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
      .join(', ');
  }

  /**
   * Verify X API connection
   * Supports OAuth 1.0a User Context (works on Free, Basic, Pro) and Bearer Token
   */
  static async verifyConnection() {
    const cfg = this.getConfig();
    if (!cfg.hasBearerToken && !cfg.hasOAuthCredentials) {
      return {
        success: false,
        status: 'Needs Configuration',
        message: 'No X credentials found. Please set X_BEARER_TOKEN or OAuth keys in Render environment variables.'
      };
    }

    // 1. First attempt: Verify via OAuth 1.0a User Context against /2/users/me (official user verification)
    if (cfg.hasOAuthCredentials) {
      try {
        const url = 'https://api.twitter.com/2/users/me';
        const authHeader = this.generateOAuth1Header('GET', url, cfg.apiKey, cfg.apiSecret, cfg.accessToken, cfg.accessSecret);
        const options = {
          hostname: 'api.twitter.com',
          path: '/2/users/me?user.fields=name,username,verified',
          method: 'GET',
          headers: {
            'Authorization': authHeader,
            'User-Agent': 'UPPCL-Grievance-Command-Centre/1.0'
          }
        };

        const resp = await this.makeRequest(options);
        if (resp.statusCode === 200 && resp.data && resp.data.data) {
          const user = resp.data.data;
          db.run(`UPDATE system_settings SET value = 'Connected' WHERE key = 'x_connection_status';`);
          db.run(`UPDATE system_settings SET value = ? WHERE key = 'x_account_id';`, [user.id]);
          db.flush();
          return {
            success: true,
            status: 'Connected',
            user: user,
            message: `Verified successfully via OAuth 1.0a! Connected to @${user.username} (${user.name})`
          };
        }
      } catch (oauthErr) {
        console.warn('OAuth1 verification attempt error:', oauthErr.message);
      }
    }

    // 2. Second attempt: Verify via App-Only Bearer Token against /2/users/by/username/:username
    if (cfg.hasBearerToken) {
      try {
        const username = cfg.accountHandle.replace(/^@/, '');
        const options = {
          hostname: 'api.twitter.com',
          path: `/2/users/by/username/${encodeURIComponent(username)}?user.fields=name,username,verified`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cfg.bearerToken}`,
            'User-Agent': 'UPPCL-Grievance-Command-Centre/1.0'
          }
        };

        const resp = await this.makeRequest(options);
        if (resp.statusCode === 200 && resp.data && resp.data.data) {
          const user = resp.data.data;
          db.run(`UPDATE system_settings SET value = 'Connected' WHERE key = 'x_connection_status';`);
          db.run(`UPDATE system_settings SET value = ? WHERE key = 'x_account_id';`, [user.id]);
          db.flush();
          return {
            success: true,
            status: 'Connected',
            user: user,
            message: `Verified successfully via Bearer Token! Connected to @${user.username} (${user.name})`
          };
        } else {
          const detail = resp.data && (resp.data.detail || resp.data.title || resp.data.message || (resp.data.errors && resp.data.errors[0] && resp.data.errors[0].message));
          return {
            success: false,
            status: 'Error',
            message: detail || `HTTP ${resp.statusCode}: Unauthorized`,
            hint: 'If on X API Free Tier, reading user profiles requires regenerating your Bearer Token in Developer Portal or verifying your API Key/Secret.'
          };
        }
      } catch (err) {
        return {
          success: false,
          status: 'Error',
          message: `Network error connecting to X API: ${err.message}`
        };
      }
    }

    return {
      success: false,
      status: 'Error',
      message: 'Authentication failed. Please verify that your keys in Developer Portal have not been regenerated.'
    };
  }

  /**
   * Poll mentions and recent posts from official X API v2
   */
  static async pollRecentPosts() {
    const cfg = this.getConfig();
    const nowIst = new Date(Date.now() + (3600000 * 5.5)).toISOString().replace('T', ' ').substring(0, 19);

    if (!cfg.hasBearerToken) {
      db.run(`UPDATE system_settings SET value = ? WHERE key = 'x_last_sync_at';`, [nowIst]);
      db.run(`UPDATE system_settings SET value = 'Needs Configuration' WHERE key = 'x_last_sync_status';`);
      return {
        ingestedCount: 0,
        status: 'Needs Configuration',
        message: 'X Bearer Token is not set. Add credentials in System Configuration.'
      };
    }

    try {
      // Focused query covering strictly the 5 Monitored Official Handles: @UPPCLLKO, @EMofficeUP, @AKSharmaOffice, @aksharmaBharat, @mduppcl
      const query = '(@UPPCLLKO OR @EMofficeUP OR @AKSharmaOffice OR @aksharmaBharat OR @mduppcl) -is:retweet -from:UPPCLLKO -from:EMofficeUP -from:AKSharmaOffice -from:aksharmaBharat -from:mduppcl';
      let path = `/2/tweets/search/recent?query=${encodeURIComponent(query)}&tweet.fields=created_at,author_id,conversation_id,in_reply_to_user_id,public_metrics,lang&expansions=author_id&user.fields=name,username,profile_image_url&max_results=50`;
      if (cfg.sinceId) {
        path += `&since_id=${encodeURIComponent(cfg.sinceId)}`;
      }

      const options = {
        hostname: 'api.twitter.com',
        path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cfg.bearerToken}`,
          'User-Agent': 'UPPCL-Grievance-Command-Centre/1.0'
        }
      };

      const resp = await this.makeRequest(options);

      if (resp.statusCode === 200 && resp.data) {
        const tweets = resp.data.data || [];
        const users = (resp.data.includes && resp.data.includes.users) || [];
        const userMap = {};
        users.forEach(u => { userMap[u.id] = u; });

        let newestId = cfg.sinceId;
        let ingestedCount = 0;

        for (const t of tweets) {
          if (!newestId || BigInt(t.id) > BigInt(newestId)) {
            newestId = t.id;
          }

          const author = userMap[t.author_id] || { username: 'consumer', name: 'Consumer' };
          const cleanAuthor = (author.username || '').toLowerCase().replace('@', '');

          // Strictly skip tweets authored by any official hierarchy handle (broadcasts/field updates)
          const isHierarchyAuthor = db.get(`
            SELECT id FROM x_hierarchy 
            WHERE REPLACE(LOWER(handle_name), '@', '') = ? 
            LIMIT 1;
          `, [cleanAuthor]);

          if (isHierarchyAuthor) {
            continue;
          }

          // Strictly enforce that incoming post mentions at least one of the 5 official monitored handles
          if (!isPostEligible(t.text, t.entities)) {
            continue;
          }

          const matchedHandle = resolvePrimaryMonitoredAccount(t.text, t.entities) || '@UPPCLLKO';

          const postUrl = `https://x.com/${author.username}/status/${t.id}`;
          const mentioned = this.findMentionedHierarchyHandle(t.text);
          const isTagged = 1;

          const res = await this.ingestPostRecord({
            postId: t.id,
            conversationId: t.conversation_id || t.id,
            authorId: t.author_id,
            authorUsername: '@' + author.username,
            authorName: author.name,
            text: t.text,
            postUrl,
            createdAtX: t.created_at || nowIst,
            matchedHandle,
            isTagged,
            hintDiscom: mentioned ? mentioned.discom_name : null,
            hintDistrict: mentioned ? mentioned.district_name : null
          });

          if (res.ingested) ingestedCount++;
        }

        // Update checkpoint
        if (newestId && newestId !== cfg.sinceId) {
          db.run(`UPDATE system_settings SET value = ? WHERE key = 'x_since_id';`, [newestId]);
        }
        db.run(`UPDATE system_settings SET value = ? WHERE key = 'x_last_sync_at';`, [nowIst]);
        db.run(`UPDATE system_settings SET value = 'Success' WHERE key = 'x_last_sync_status';`);
        db.flush();

        return {
          ingestedCount,
          status: 'Success',
          message: `Successfully processed ${tweets.length} tweets from X (${ingestedCount} new complaints registered).`
        };
      } else if (resp.statusCode === 429) {
        db.run(`UPDATE system_settings SET value = 'Degraded' WHERE key = 'x_connection_status';`);
        db.run(`UPDATE system_settings SET value = 'Rate Limited' WHERE key = 'x_last_sync_status';`);
        return {
          ingestedCount: 0,
          status: 'Degraded',
          message: 'X API rate limit reached. Backoff until window resets.'
        };
      } else {
        const errMsg = resp.data.detail || `HTTP ${resp.statusCode}`;
        db.run(`UPDATE system_settings SET value = ? WHERE key = 'x_last_sync_status';`, [`Error: ${errMsg}`]);
        return {
          ingestedCount: 0,
          status: 'Error',
          message: errMsg
        };
      }
    } catch (err) {
      db.run(`UPDATE system_settings SET value = ? WHERE key = 'x_last_sync_status';`, [`Error: ${err.message}`]);
      return {
        ingestedCount: 0,
        status: 'Error',
        message: err.message
      };
    }
  }

  /**
   * Scan post text to detect if any official hierarchy handle is mentioned.
   * Prioritizes longer/more specific field handles before corporate handles.
   */
  static findMentionedHierarchyHandle(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    try {
      const hierarchyRows = db.query("SELECT handle_name, discom_name, district_name FROM x_hierarchy WHERE handle_name IS NOT NULL AND handle_name != '' ORDER BY LENGTH(handle_name) DESC");
      for (const h of hierarchyRows) {
        if (h.handle_name && lower.includes(h.handle_name.toLowerCase())) {
          return h;
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Ingest a single post record with deduplication, classification, and drafting
   */
  static async ingestPostRecord(post) {
    const existingIncoming = db.get('SELECT id FROM x_incoming_posts WHERE post_id = ?;', [post.postId]);
    const existingComp = db.get('SELECT id, complaint_no FROM complaints WHERE post_url = ?;', [post.postUrl]);

    if (existingIncoming || existingComp) {
      return { ingested: false, reason: 'Duplicate post ID or URL' };
    }

    // Strictly skip posts authored by official hierarchy handles
    const cleanAuthor = (post.authorUsername || '').toLowerCase().replace('@', '');
    const isHierarchyAuthor = db.get(`
      SELECT id FROM x_hierarchy 
      WHERE REPLACE(LOWER(handle_name), '@', '') = ? 
      LIMIT 1;
    `, [cleanAuthor]);

    if (isHierarchyAuthor) {
      return { ingested: false, reason: 'Ignored post authored by official hierarchy handle' };
    }

    const processed = Classifier.processIncomingPost({
      text: post.text,
      matched_handle: post.matchedHandle
    });

    const finalDiscom = (post.hintDiscom && post.hintDiscom !== 'UPPCL HQ' && post.hintDiscom !== 'Corporate Headquarters') ? post.hintDiscom : processed.discom_name;
    const finalDistrict = (post.hintDistrict && post.hintDistrict !== 'Corporate Headquarters' && post.hintDistrict !== 'Energy Minister Sir') ? post.hintDistrict : processed.district_name;

    // Generate Sequential Complaint Number: UPPCL-SMC-YYYYMM-XXXX
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));
    const yyyymm = `${ist.getFullYear()}${String(ist.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `UPPCL-SMC-${yyyymm}-`;

    const lastRow = db.get(`
      SELECT complaint_no FROM complaints
      WHERE complaint_no LIKE ?
      ORDER BY id DESC LIMIT 1;
    `, [`${prefix}%`]);

    let seq = 1;
    if (lastRow && lastRow.complaint_no) {
      const parts = lastRow.complaint_no.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const complaintNo = `${prefix}${String(seq).padStart(4, '0')}`;

    // Calculate SLA Expected Date
    const slaTarget = new Date(ist.getTime() + (processed.sla_hours * 3600000));
    const expectedResponseDate = slaTarget.toISOString().replace('T', ' ').substring(0, 19);
    const nowIst = ist.toISOString().replace('T', ' ').substring(0, 19);

    // Initial Status
    const initialStatus = processed.is_unassigned ? 'New' : 'New';
    const isTagged = post.isTagged !== undefined ? (post.isTagged ? 1 : 0) : 1;

    // Insert into complaints
    const compRes = db.run(`
      INSERT INTO complaints (
        complaint_no, received_at, platform, monitored_account, is_tagged,
        consumer_name, consumer_handle, post_url, complaint_text,
        category_name, discom_name, district_name, consumer_account_no, consumer_mobile,
        priority, current_status, expected_response_date, is_overdue,
        original_post_id, conversation_id, author_id, reply_status,
        created_by, created_at, updated_at
      ) VALUES (
        ?, ?, 'Twitter/X', ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, 0,
        ?, ?, ?, 'None',
        'X_INGESTION_WORKER', ?, ?
      );
    `, [
      complaintNo, nowIst, post.matchedHandle || '@UPPCLLKO', isTagged,
      post.authorName || 'Consumer', post.authorUsername, post.postUrl, processed.clean_text,
      processed.category_name, finalDiscom, finalDistrict,
      processed.consumer_account_no, processed.consumer_mobile,
      processed.priority, initialStatus, expectedResponseDate,
      post.postId, post.conversationId, post.authorId,
      nowIst, nowIst
    ]);

    const compId = compRes.lastInsertRowid;

    // Log raw incoming post
    db.run(`
      INSERT INTO x_incoming_posts (
        post_id, conversation_id, author_id, author_username, author_name,
        post_text, post_url, created_at_x, ingested_at, matched_handle,
        classification_category, classification_district, classification_discom,
        classification_confidence, complaint_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Processed');
    `, [
      post.postId, post.conversationId, post.authorId, post.authorUsername, post.authorName,
      processed.clean_text, post.postUrl, post.createdAtX, nowIst, post.matchedHandle,
      processed.category_name, processed.district_name, processed.discom_name,
      processed.confidence, compId
    ]);

    // Initial Timeline Event
    db.run(`
      INSERT INTO complaint_timeline (
        complaint_id, action_type, old_status, new_status,
        user_id, user_name, user_role, remarks, created_at
      ) VALUES (?, 'Registration', NULL, ?, 1, 'X Ingestion Worker', 'Automated Pipeline', 'Auto-ingested from X post', ?);
    `, [compId, initialStatus, nowIst]);

    // Generate Suggested Reply Draft from Approved Templates (Modes B & C)
    const tmpl = db.get(`
      SELECT id, body FROM reply_templates
      WHERE category_name = ? AND stage = 'acknowledgement' AND is_active = 1
      ORDER BY language = 'hi' DESC LIMIT 1;
    `, [processed.category_name]) || db.get(`
      SELECT id, body FROM reply_templates
      WHERE stage = 'acknowledgement' AND is_active = 1 LIMIT 1;
    `);

    if (tmpl) {
      let draft = tmpl.body
        .replace(/{consumer_name}/g, post.authorName || 'Consumer')
        .replace(/{complaint_no}/g, complaintNo)
        .replace(/{district}/g, processed.district_name || 'Uttar Pradesh')
        .replace(/{discom}/g, processed.discom_name || 'UPPCL')
        .replace(/{sla_hours}/g, processed.sla_hours);

      db.run(`
        UPDATE complaints
        SET reply_draft = ?, reply_status = 'Draft'
        WHERE id = ?;
      `, [draft, compId]);

      // If Mode C (Approved Workflow Automation) and not emergency stopped, dispatch acknowledgement
      const cfg = this.getConfig();
      if (cfg.automationMode === 'Mode C - Approved Workflow Automation' && !cfg.emergencyStop) {
        this.publishReply(post.postId, draft, compId, 1, 'X Ingestion Worker').catch(err => {
          console.warn('Mode C auto-reply failed:', err.message);
        });
      }
    }

    // In-app Notification for operators
    db.run(`
      INSERT INTO notifications (user_id, title, message, type, link_url, is_read, created_at)
      VALUES (
        NULL,
        'New Complaint: ' || ?,
        'Grievance registered from ' || ? || ' for ' || ? || ' (' || ? || ')',
        'assignment',
        'register',
        0,
        ?
      );
    `, [complaintNo, post.authorUsername, processed.category_name, processed.district_name, nowIst]);

    db.flush();
    return { ingested: true, complaintId: compId, complaintNo };
  }

  /**
   * Publish Reply to an X Post (handles idempotency, emergency stop, and modes)
   */
  static async publishReply(arg1, arg2, arg3, arg4, arg5) {
    const cfg = this.getConfig();

    // 1. Emergency Stop Check
    if (cfg.emergencyStop) {
      return {
        success: false,
        code: 'EMERGENCY_STOP_ACTIVE',
        error: 'Action blocked: Emergency Stop is currently ACTIVE on the command centre.'
      };
    }

    let complaintId, user, replyText, inReplyToPostId;
    if (typeof arg2 === 'object' && arg2 !== null && !Array.isArray(arg2)) {
      // Signature: publishReply(complaintId, userObj, replyText)
      complaintId = parseInt(arg1, 10);
      user = arg2;
      replyText = arg3;
      const comp = db.get('SELECT original_post_id FROM complaints WHERE id = ?;', [complaintId]);
      inReplyToPostId = (comp && comp.original_post_id) ? comp.original_post_id : `mock-post-${complaintId}`;
    } else {
      // Signature: publishReply(inReplyToPostId, replyText, complaintId, userId, username)
      inReplyToPostId = arg1;
      replyText = arg2;
      complaintId = arg3;
      user = { id: arg4 || 1, full_name: arg5 || 'Admin', username: arg5 || 'admin' };
    }

    // 2. Mode Check
    if (cfg.automationMode === 'A' || cfg.automationMode === 'Mode A - Monitor Only') {
      return {
        success: false,
        code: 'MODE_A_RESTRICTED',
        error: 'Action blocked: System is in Mode A (Monitor Only). Outbound replies are disabled.'
      };
    }

    // 3. Idempotency Check (Never send duplicate replies to same tweet)
    const existingReply = db.get(`
      SELECT id, x_reply_id, status FROM x_outgoing_replies
      WHERE in_reply_to_post_id = ? AND status IN ('Published', 'SENT', 'Pending');
    `, [inReplyToPostId]);

    if (existingReply && (existingReply.status === 'Published' || existingReply.status === 'SENT')) {
      return {
        success: false,
        code: 'ALREADY_PUBLISHED',
        error: `Reply already published for tweet ${inReplyToPostId} (Reply ID: ${existingReply.x_reply_id})`
      };
    }

    const nowIst = new Date(Date.now() + (3600000 * 5.5)).toISOString().replace('T', ' ').substring(0, 19);

    // Insert pending record
    const replyRecord = db.run(`
      INSERT INTO x_outgoing_replies (
        complaint_id, in_reply_to_post_id, reply_text, automation_mode,
        status, sent_by_user_id, sent_by_username, created_at
      ) VALUES (?, ?, ?, ?, 'Pending', ?, ?, ?);
    `, [complaintId, inReplyToPostId, replyText, cfg.automationMode, user.id || 1, user.full_name || 'Admin', nowIst]);

    const replyLogId = replyRecord.lastInsertRowid;

    // 4. Dispatch to X API if credentials exist
    if (cfg.hasOAuthCredentials || cfg.hasBearerToken) {
      try {
        const payload = {
          text: replyText,
          reply: {
            in_reply_to_tweet_id: inReplyToPostId
          }
        };

        let authHeader = `Bearer ${cfg.bearerToken || cfg.accessToken}`;
        if (cfg.hasOAuthCredentials) {
          authHeader = this.generateOAuth1Header(
            'POST',
            'https://api.twitter.com/2/tweets',
            cfg.apiKey,
            cfg.apiSecret,
            cfg.accessToken,
            cfg.accessSecret
          );
        }

        const options = {
          hostname: 'api.twitter.com',
          path: '/2/tweets',
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'User-Agent': 'UPPCL-Grievance-Command-Centre/1.0'
          }
        };

        const resp = await this.makeRequest(options, payload);

        if (resp.statusCode === 201 && resp.data && resp.data.data) {
          const publishedId = resp.data.data.id;
          db.run(`
            UPDATE x_outgoing_replies
            SET status = 'SENT', x_reply_id = ?, published_at = ?
            WHERE id = ?;
          `, [publishedId, nowIst, replyLogId]);

          db.run(`
            UPDATE complaints
            SET reply_status = 'SENT', published_reply_id = ?, first_acknowledged_at = COALESCE(first_acknowledged_at, ?)
            WHERE id = ?;
          `, [publishedId, nowIst, complaintId]);

          db.run(`
            INSERT INTO complaint_timeline (
              complaint_id, action_type, old_status, new_status,
              user_id, user_name, user_role, remarks, created_at
            ) VALUES (?, 'Public Acknowledgement Sent', NULL, NULL, ?, ?, 'Official SMC Account', 'Reply published on X (ID: ' || ? || ')', ?);
          `, [complaintId, user.id || 1, user.full_name || 'Admin', publishedId, nowIst]);

          db.flush();
          return { success: true, reply_id: publishedId, status: 'SENT' };
        } else {
          const errMsg = (resp.data && resp.data.detail) || `X API responded with HTTP ${resp.statusCode}`;
          db.run(`
            UPDATE x_outgoing_replies
            SET status = 'Failed', error_message = ?
            WHERE id = ?;
          `, [errMsg, replyLogId]);

          db.run(`UPDATE complaints SET reply_status = 'FAILED' WHERE id = ?;`, [complaintId]);
          db.flush();
          return { success: false, code: 'API_ERROR', error: errMsg };
        }
      } catch (err) {
        db.run(`
          UPDATE x_outgoing_replies
          SET status = 'Failed', error_message = ?
          WHERE id = ?;
        `, [err.message, replyLogId]);
        db.flush();
        return { success: false, code: 'NETWORK_ERROR', error: err.message };
      }
    } else {
      // Mock publish in development / staging when credentials not set
      const mockId = `MOCK-REPLY-${Date.now()}`;
      db.run(`
        UPDATE x_outgoing_replies
        SET status = 'SENT', x_reply_id = ?, published_at = ?
        WHERE id = ?;
      `, [mockId, nowIst, replyLogId]);

      db.run(`
        UPDATE complaints
        SET reply_status = 'SENT', published_reply_id = ?, first_acknowledged_at = COALESCE(first_acknowledged_at, ?)
        WHERE id = ?;
      `, [mockId, nowIst, complaintId]);

      db.run(`
        INSERT INTO complaint_timeline (
          complaint_id, action_type, old_status, new_status,
          user_id, user_name, user_role, remarks, created_at
        ) VALUES (?, 'Public Acknowledgement Sent', NULL, NULL, ?, ?, 'Official SMC Account', 'Reply recorded on dashboard (Mock Mode)', ?);
      `, [complaintId, user.id || 1, user.full_name || 'Admin', nowIst]);

      db.flush();
      return { success: true, reply_id: mockId, status: 'SENT' };
    }
  }
}

XService.XService = XService;
module.exports = XService;

