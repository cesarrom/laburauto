#!/usr/bin/env node

/**
 * Teardown Test Database
 * Stops and removes the test database container
 */

const { execSync } = require('child_process');

const CONTAINER_NAME = 'laburauto-test-db';
const DOCUSEAL_CONTAINER_NAME = 'laburauto-test-docuseal';
const DOCUSEAL_DB_CONTAINER_NAME = 'laburauto-test-docuseal-db';

console.log('\x1b[36m[test-db]\x1b[0m Tearing down test database...');

try {
  execSync(`docker rm -f ${CONTAINER_NAME}`, { stdio: 'inherit' });
  execSync(`docker rm -f ${DOCUSEAL_CONTAINER_NAME}`, { stdio: 'inherit' });
  execSync(`docker rm -f ${DOCUSEAL_DB_CONTAINER_NAME}`, { stdio: 'inherit' });
  console.log('\x1b[36m[test-db]\x1b[0m Test database and Docuseal removed successfully');
} catch (err) {
  console.error('\x1b[31m[test-db ERROR]\x1b[0m Failed to remove test test containers');
  process.exit(1);
}
