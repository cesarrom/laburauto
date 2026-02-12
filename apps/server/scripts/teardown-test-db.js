#!/usr/bin/env node

/**
 * Teardown Test Database
 * Stops and removes the test database container
 */

const { execSync } = require('child_process');

const CONTAINER_NAME = 'laburauto-test-db';

console.log('\x1b[36m[test-db]\x1b[0m Tearing down test database...');

try {
  execSync(`docker rm -f ${CONTAINER_NAME}`, { stdio: 'inherit' });
  console.log('\x1b[36m[test-db]\x1b[0m Test database removed successfully');
} catch (err) {
  console.error('\x1b[31m[test-db ERROR]\x1b[0m Failed to remove test database');
  process.exit(1);
}
