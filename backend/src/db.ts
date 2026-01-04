import Database from "better-sqlite3";

export type Db = Database.Database;

export type AgentKeyRecord = {
  agent_id: number;
  owner_address: string;
  encrypted_key: string;
  iv: string;
  tag: string;
  provider: string;
  payout_address: string;
  created_at: string;
  updated_at: string;
};

export type UsageReceipt = {
  agent_id: number;
  payer_address: string;
  amount: number;
  request_hash: string;
  created_at: string;
};

export function initDb(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_keys (
      agent_id INTEGER PRIMARY KEY,
      owner_address TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      iv TEXT NOT NULL,
      tag TEXT NOT NULL,
      provider TEXT NOT NULL,
      payout_address TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usage_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id INTEGER NOT NULL,
      payer_address TEXT NOT NULL,
      amount INTEGER NOT NULL,
      request_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS nonces (
      address TEXT NOT NULL,
      nonce TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (address, nonce)
    );
  `);
  return db;
}

export function getAgentKey(db: Db, agentId: number): AgentKeyRecord | undefined {
  const stmt = db.prepare("SELECT * FROM agent_keys WHERE agent_id = ?");
  return stmt.get(agentId) as AgentKeyRecord | undefined;
}

export function upsertAgentKey(db: Db, record: Omit<AgentKeyRecord, "created_at" | "updated_at">) {
  const now = new Date().toISOString();
  const existing = getAgentKey(db, record.agent_id);
  if (existing) {
    db.prepare(
      `UPDATE agent_keys
       SET owner_address = ?, encrypted_key = ?, iv = ?, tag = ?, provider = ?, payout_address = ?, updated_at = ?
       WHERE agent_id = ?`
    ).run(
      record.owner_address,
      record.encrypted_key,
      record.iv,
      record.tag,
      record.provider,
      record.payout_address,
      now,
      record.agent_id
    );
    return;
  }
  db.prepare(
    `INSERT INTO agent_keys (agent_id, owner_address, encrypted_key, iv, tag, provider, payout_address, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.agent_id,
    record.owner_address,
    record.encrypted_key,
    record.iv,
    record.tag,
    record.provider,
    record.payout_address,
    now,
    now
  );
}

export function insertUsageReceipt(db: Db, receipt: Omit<UsageReceipt, "created_at">) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO usage_receipts (agent_id, payer_address, amount, request_hash, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    receipt.agent_id,
    receipt.payer_address,
    receipt.amount,
    receipt.request_hash,
    now
  );
}

export function insertNonce(db: Db, address: string, nonce: string, expiresAt: number) {
  db.prepare(
    "INSERT INTO nonces (address, nonce, expires_at, used) VALUES (?, ?, ?, 0)"
  ).run(address, nonce, expiresAt);
}

export function consumeNonce(db: Db, address: string, nonce: string, now: number): boolean {
  const stmt = db.prepare(
    `UPDATE nonces
     SET used = 1
     WHERE address = ? AND nonce = ? AND used = 0 AND expires_at >= ?`
  );
  const result = stmt.run(address, nonce, now);
  return result.changes === 1;
}
