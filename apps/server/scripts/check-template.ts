
import { db } from '../src/db';
import { contractTemplates } from '@laburauto/shared/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('Checking for rental_agreement template...');

  try {
    const template = await db.query.contractTemplates.findFirst({
      where: eq(contractTemplates.type, 'rental_agreement')
    });

    if (template) {
      console.log('✅ Template FOUND:', template.id, template.name);
    } else {
      console.log('❌ Template NOT FOUND! This is why contractId is null.');

      // Auto-seed if missing for convenience?
      console.log('Attempting to create it...');
      const [newTemplate] = await db.insert(contractTemplates).values({
        name: 'Standard Rental Agreement',
        type: 'rental_agreement',
        pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // Dummy PDF for dev
        fields: [],
        stages: [
          { id: 'publisher_sign', role: 'publisher', action: 'sign', order: 1 },
          { id: 'renter_sign', role: 'renter', action: 'sign', order: 2 }
        ],
        variableSchema: []
      }).returning();
      console.log('✅ Created dummy template:', newTemplate.id);
    }
  } catch (err) {
    console.error('Error checking DB:', err);
  }
  process.exit(0);
}

check();
