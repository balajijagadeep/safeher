const path = require('path');
const fs = require('fs');

let dbInstance = null;

function getDatabase() {
    if (dbInstance) {
        return dbInstance;
    }

    const dbPath = path.resolve(__dirname, '..', 'safeher.db');

    try {
        // Preferred on Node 22+: Native zero-dependency built-in SQLite
        const { DatabaseSync } = require('node:sqlite');
        const db = new DatabaseSync(dbPath);
        db.exec('PRAGMA foreign_keys = ON;');
        
        // Wrap to ensure 100% standard API compatibility
        dbInstance = {
            exec: (sql) => db.exec(sql),
            prepare: (sql) => {
                const stmt = db.prepare(sql);
                return {
                    run: (...args) => stmt.run(...args),
                    get: (...args) => stmt.get(...args),
                    all: (...args) => stmt.all(...args)
                };
            },
            close: () => db.close()
        };
        console.log('[SafeHer DB] Connected via Node native SQLite (node:sqlite)');
    } catch (err) {
        try {
            // Fallback for older Node versions if better-sqlite3 is installed
            const BetterSqlite3 = require('better-sqlite3');
            const db = new BetterSqlite3(dbPath);
            db.pragma('foreign_keys = ON');
            dbInstance = db;
            console.log('[SafeHer DB] Connected via better-sqlite3');
        } catch (fallbackErr) {
            console.error('[SafeHer DB] Failed to initialize SQLite:', err.message);
            throw fallbackErr;
        }
    }

    return dbInstance;
}

module.exports = {
    getDatabase
};
