
const postgres = require('postgres');
require('dotenv').config();

const sql = postgres(process.env.DATABASE_URL);

async function checkCols() {
  try {
    const cols = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicles';
    `;
    console.log(JSON.stringify(cols, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkCols();
