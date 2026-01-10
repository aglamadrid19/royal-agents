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
  max_amount: number;
  tool_calls: number;
  status: string;
  request_hash: string;
  created_at: string;
};

export type AgentConfigRecord = {
  agent_id: number;
  config_hash: string;
  encrypted_config: string;
  iv: string;
  tag: string;
  created_at: string;
  updated_at: string;
};

export type AgentRunnerRecord = {
  agent_id: number;
  owner_address: string;
  runner_url: string;
  encrypted_secret: string;
  iv: string;
  tag: string;
  created_at: string;
  updated_at: string;
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
      max_amount INTEGER NOT NULL DEFAULT 0,
      tool_calls INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'settled',
      request_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_configs (
      agent_id INTEGER PRIMARY KEY,
      config_hash TEXT NOT NULL,
      encrypted_config TEXT NOT NULL,
      iv TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_runners (
      agent_id INTEGER PRIMARY KEY,
      owner_address TEXT NOT NULL,
      runner_url TEXT NOT NULL,
      encrypted_secret TEXT NOT NULL,
      iv TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS nonces (
      address TEXT NOT NULL,
      nonce TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (address, nonce)
    );
  `);
  ensureColumn(db, "usage_receipts", "max_amount", "INTEGER", "0");
  ensureColumn(db, "usage_receipts", "tool_calls", "INTEGER", "0");
  ensureColumn(db, "usage_receipts", "status", "TEXT", "'settled'");
  return db;
}

function ensureColumn(db: Db, table: string, column: string, type: string, defaultValue: string) {
  const existing = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((row: any) => row.name === column);
  if (!existing) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} NOT NULL DEFAULT ${defaultValue}`);
  }
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
    `INSERT INTO usage_receipts (agent_id, payer_address, amount, max_amount, tool_calls, status, request_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    receipt.agent_id,
    receipt.payer_address,
    receipt.amount,
    receipt.max_amount,
    receipt.tool_calls,
    receipt.status,
    receipt.request_hash,
    now
  );
}

export function getAgentConfig(db: Db, agentId: number): AgentConfigRecord | undefined {
  const stmt = db.prepare("SELECT * FROM agent_configs WHERE agent_id = ?");
  return stmt.get(agentId) as AgentConfigRecord | undefined;
}

export function insertAgentConfig(db: Db, record: Omit<AgentConfigRecord, "created_at" | "updated_at">) {
  const existing = getAgentConfig(db, record.agent_id);
  if (existing) {
    throw new Error("config_already_set");
  }
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO agent_configs (agent_id, config_hash, encrypted_config, iv, tag, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.agent_id,
    record.config_hash,
    record.encrypted_config,
    record.iv,
    record.tag,
    now,
    now
  );
}

export function getAgentRunner(db: Db, agentId: number): AgentRunnerRecord | undefined {
  const stmt = db.prepare("SELECT * FROM agent_runners WHERE agent_id = ?");
  return stmt.get(agentId) as AgentRunnerRecord | undefined;
}

export function upsertAgentRunner(
  db: Db,
  record: Omit<AgentRunnerRecord, "created_at" | "updated_at">
) {
  const now = new Date().toISOString();
  const existing = getAgentRunner(db, record.agent_id);
  if (existing) {
    db.prepare(
      `UPDATE agent_runners
       SET owner_address = ?, runner_url = ?, encrypted_secret = ?, iv = ?, tag = ?, updated_at = ?
       WHERE agent_id = ?`
    ).run(
      record.owner_address,
      record.runner_url,
      record.encrypted_secret,
      record.iv,
      record.tag,
      now,
      record.agent_id
    );
    return;
  }
  db.prepare(
    `INSERT INTO agent_runners (agent_id, owner_address, runner_url, encrypted_secret, iv, tag, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.agent_id,
    record.owner_address,
    record.runner_url,
    record.encrypted_secret,
    record.iv,
    record.tag,
    now,
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
