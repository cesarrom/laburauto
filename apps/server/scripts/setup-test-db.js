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
 * 6. Starts a Docuseal test instance bound to localhost
 * 7. Exports DATABASE_URL and DOCUSEAL_INTERNAL_URL for tests
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CONTAINER_NAME = 'laburauto-test-db';
const DOCUSEAL_CONTAINER_NAME = 'laburauto-test-docuseal';
const DOCUSEAL_DB_CONTAINER_NAME = 'laburauto-test-docuseal-db';
const START_PORT = 5433; // Start from 5433 to avoid common dev DB on 5432
const DOCUSEAL_START_PORT = 3100;
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
  const docusealPort = DOCUSEAL_START_PORT + (port - START_PORT);
  const DOCUSEAL_INTERNAL_URL = `http://localhost:${docusealPort}`;

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

  test-docuseal-db:
    image: postgres:15
    container_name: ${DOCUSEAL_DB_CONTAINER_NAME}
    environment:
      POSTGRES_USER: test_user
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: laburauto_docuseal_test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test_user -d laburauto_docuseal_test"]
      interval: 2s
      timeout: 5s
      retries: 5

  test-docuseal:
    image: docuseal/docuseal:latest
    container_name: ${DOCUSEAL_CONTAINER_NAME}
    environment:
      DATABASE_URL: postgres://test_user:test_password@test-docuseal-db:5432/laburauto_docuseal_test
      SECRET_KEY_BASE: test-docuseal-secret-key-for-integration-tests
      FORCE_SSL: false
    depends_on:
      test-docuseal-db:
        condition: service_healthy
    ports:
      - "${docusealPort}:3000"
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

    return { success: true, port, DATABASE_URL, docusealPort, DOCUSEAL_INTERNAL_URL };
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
      exec(`docker rm -f ${DOCUSEAL_CONTAINER_NAME}`, { ignoreError: true, silent: true });
      exec(`docker rm -f ${DOCUSEAL_DB_CONTAINER_NAME}`, { ignoreError: true, silent: true });
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

  const { port, DATABASE_URL, docusealPort, DOCUSEAL_INTERNAL_URL } = result;

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

  // Step 4: Wait for Docuseal to be reachable
  log(`Waiting for Docuseal to be ready on port ${docusealPort}...`);
  attempts = 0;
  while (attempts < maxAttempts) {
    const reachable = exec(
      `curl -fsS -o /dev/null ${DOCUSEAL_INTERNAL_URL}`,
      { silent: true, ignoreError: true }
    );

    if (reachable !== null) {
      log('Docuseal is reachable!');
      break;
    }

    attempts++;
    if (attempts >= maxAttempts) {
      error('Docuseal failed to become reachable');
      process.exit(1);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Step 5: Run migrations
  log('Running Drizzle migrations...');

  // Create .env.test file
  const envTestPath = path.join(__dirname, '../.env.test');
  fs.writeFileSync(
    envTestPath,
    `DATABASE_URL=${DATABASE_URL}\nDOCUSEAL_INTERNAL_URL=${DOCUSEAL_INTERNAL_URL}\nDOCUSEAL_ENABLED=true\n`
  );

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

  // Step 6: Export test URLs to tests directory
  log('Test database is ready!');
  log(`DATABASE_URL=${DATABASE_URL}`);
  log(`DOCUSEAL_INTERNAL_URL=${DOCUSEAL_INTERNAL_URL}`);

  // Write to tests directory where test-db.ts expects it
  const testDbUrlFile = path.join(__dirname, '../tests/.test-db-url');
  fs.writeFileSync(testDbUrlFile, DATABASE_URL);

  const testDocusealUrlFile = path.join(__dirname, '../tests/.test-docuseal-url');
  fs.writeFileSync(testDocusealUrlFile, DOCUSEAL_INTERNAL_URL);

  log(`Database URL written to: ${testDbUrlFile}`);
  log(`Docuseal URL written to: ${testDocusealUrlFile}`);
}

main().catch(err => {
  error(err.message);
  process.exit(1);
});
