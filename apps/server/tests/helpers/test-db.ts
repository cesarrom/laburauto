import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from '@laburauto/shared/schema';
import { sql as drizzleSql } from 'drizzle-orm';

/**
 * Test Database Helper
 * 
 * Uses real PostgreSQL database from Docker container.
 * Database is created and migrated by scripts/setup-test-db.js
 */

let testDb: any = null;
let testSql: any = null;

export async function setupTestDatabase() {
  // Read DATABASE_URL from file created by setup script
  const dbUrlFile = path.join(__dirname, '../.test-db-url');

  if (!fs.existsSync(dbUrlFile)) {
    throw new Error('Test database not initialized. Run: pnpm test:setup');
  }

  process.env.DATABASE_URL = fs.readFileSync(dbUrlFile, 'utf-8').trim();

  // Create fresh postgres connection for this test suite
  // We CANNOT import from src/db because that singleton gets cached and closed 
  // by the first test file's teardown, causing subsequent tests to fail.
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const db = drizzle(sql, {
    schema
  });

  // Clean all tables before each test
  await cleanDatabase(db);

  testDb = db;
  testSql = sql;

  return { db, sql };
}

export async function teardownTestDatabase() {
  if (testSql) {
    await testSql.end();
    testSql = null;
    testDb = null;
  }
}

async function cleanDatabase(db: any) {
  // Use TRUNCATE CASCADE to clean everything respecting FKs efficiently
  // and handle any lingering async inserts that might race with sequential deletes
  await db.execute(drizzleSql`
    TRUNCATE TABLE
      users,
      vehicles,
      vehicle_models,
      bookings,
      contract_instances,
      contract_templates,
      audit_logs,
      ratings,
      notifications,
      magic_links,
      renter_documents,
      publisher_documents,
      rental_applications,
      shifts
    RESTART IDENTITY CASCADE
  `);
}
