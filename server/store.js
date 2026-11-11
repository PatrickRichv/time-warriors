import pg from 'pg';
const memory = [];
let pool;
export async function initStore() {
  if (!process.env.DATABASE_URL) return;
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  await pool.query(`CREATE TABLE IF NOT EXISTS scores (id SERIAL PRIMARY KEY, name VARCHAR(24) NOT NULL, team VARCHAR(24), score INTEGER NOT NULL CHECK(score >= 0 AND score <= 99999), level INTEGER NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())`);
}
export async function addScore(score) {
  if (pool) { const { rows } = await pool.query('INSERT INTO scores(name,team,score,level) VALUES($1,$2,$3,$4) RETURNING id,name,team,score,level,created_at', [score.name, score.team || null, score.score, score.level]); return rows[0]; }
  const item = { id: memory.length + 1, ...score, created_at: new Date().toISOString() }; memory.push(item); return item;
}
export async function getScores() {
  if (pool) return (await pool.query('SELECT name,team,score,level,created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT 20')).rows;
  return [...memory].sort((a,b) => b.score - a.score).slice(0,20);
}
