#!/usr/bin/env node

/**
 * Test Database Setup Script
 * 
 * This script:
 * 1. Finds a free port (starting from 5433 to avoid dev DB on 5432)
 * 2. Kills any existing test database container
 * 3. Starts a fresh PostgreSQL container on the free port
 * 4. Waits for it to be healthy
 * 5. Runs all Drizzle migrations
 * 6. Exports DATABASE_URL for tests
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CONTAINER_NAME = 'laburauto-test-db';
const START_PORT = 5433; // Start from 5433 to avoid common dev DB on 5432
const MAX_PORT_ATTEMPTS = 50;

function log(message) {
  console.log(`\x1b[36m[test-db]\x1b[0m ${message}`);
}

function error(message) {
  console.error(`\x1b[31m[test-db ERROR]\x1b[0m ${message}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      ...options
    });
  } catch (err) {
    if (!options.ignoreError) {
      throw err;
    }
    return null;
  }
}

/**
 * Check if port is being used by our test container
 */
function isPortUsedByTestContainer(port) {
  try {
    const output = exec(
      `docker ps -a --filter name=${CONTAINER_NAME} --format "{{.Ports}}"`,
      { silent: true }
    );

    if (output && output.includes(`:${port}->`)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Try to start container on given port
 * Returns true if successful, false if port is taken
 */
async function tryStartContainer(port) {
  const DATABASE_URL = `postgresql://test_user:test_password@localhost:${port}/laburauto_test`;

  // Create temporary docker-compose file with the port
  const composeContent = `
version: '3.8'

services:
  test-db:
    image: postgres:15
    container_name: ${CONTAINER_NAME}
    environment:
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: laburauto_test
    ports:
      - "${port}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test_user -d laburauto_test"]
      interval: 2s
      timeout: 5s
      retries: 5
`;

  const tempComposeFile = path.join(__dirname, '../docker-compose.test.tmp.yml');
  fs.writeFileSync(tempComposeFile, composeContent);

  // Try to start container
  try {
    exec(`docker-compose -f ${tempComposeFile} up -d`, { silent: false });

    // Success! Clean up temp file and return
    if (fs.existsSync(tempComposeFile)) {
      fs.unlinkSync(tempComposeFile);
    }

    return { success: true, port, DATABASE_URL };
  } catch (err) {
    // Clean up temp file
    if (fs.existsSync(tempComposeFile)) {
      fs.unlinkSync(tempComposeFile);
    }

    // Check if it was port allocation error
    if (err.message && err.message.includes('port is already allocated')) {
      return { success: false, reason: 'port_taken' };
    }

    // Other error, rethrow
    throw err;
  }
}

async function main() {
  log('Setting up test database...');

  // Step 1: Check for and kill existing test container on any port
  log('Stopping any existing test database containers...');
  for (let p = START_PORT; p < START_PORT + MAX_PORT_ATTEMPTS; p++) {
    if (isPortUsedByTestContainer(p)) {
      log(`Found old test container on port ${p}, removing...`);
      exec(`docker rm -f ${CONTAINER_NAME}`, { ignoreError: true, silent: true });
      await new Promise(resolve => setTimeout(resolve, 2000));
      break;
    }
  }

  // Step 2: Find free port by trying to start container
  log(`Looking for free port starting from ${START_PORT}...`);

  let result = null;
  for (let port = START_PORT; port < START_PORT + MAX_PORT_ATTEMPTS; port++) {
    log(`Trying port ${port}...`);

    result = await tryStartContainer(port);

    if (result.success) {
      log(`Successfully started container on port ${port}`);
      break;
    }

    log(`Port ${port} is in use, trying next...`);
  }

  if (!result || !result.success) {
    error(`Could not find free port after ${MAX_PORT_ATTEMPTS} attempts`);
    process.exit(1);
  }

  const { port, DATABASE_URL } = result;

  // Step 3: Wait for database to be healthy
  log('Waiting for database to be ready...');
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    const health = exec(
      `docker inspect --format='{{.State.Health.Status}}' ${CONTAINER_NAME}`,
      { silent: true, ignoreError: true }
    );

    if (health && health.trim() === 'healthy') {
      log('Database is ready! Waiting extra 2s to ensure stable connection...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      break;
    }

    attempts++;
    if (attempts >= maxAttempts) {
      error('Database failed to become healthy');
      process.exit(1);
    }

    // Wait 1 second before retry
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 4: Run migrations
  log('Running Drizzle migrations...');

  // Create .env.test file
  const envTestPath = path.join(__dirname, '../.env.test');
  fs.writeFileSync(envTestPath, `DATABASE_URL=${DATABASE_URL}\n`);

  // Run drizzle migrate
  try {
    exec('pnpm db:migrate', {
      env: {
        ...process.env,
        DATABASE_URL,
        NODE_ENV: 'test'
      }
    });
    log('Migrations completed successfully!');
  } catch (err) {
    error('Migration failed');
    throw err;
  }

  // Step 5: Export DATABASE_URL to tests directory
  log('Test database is ready!');
  log(`DATABASE_URL=${DATABASE_URL}`);

  // Write to tests directory where test-db.ts expects it
  const testDbUrlFile = path.join(__dirname, '../tests/.test-db-url');
  fs.writeFileSync(testDbUrlFile, DATABASE_URL);

  log(`Database URL written to: ${testDbUrlFile}`);
}

main().catch(err => {
  error(err.message);
  process.exit(1);
});
