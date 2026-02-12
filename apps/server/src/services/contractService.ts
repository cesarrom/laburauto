import { db } from '../db';
import { contractTemplates, contractInstances, users as usersTable, vehicles as vehiclesTable, bookings as bookingsTable, vehicleModels as vehicleModelsTable } from '@laburauto/shared/schema';
import { eq } from 'drizzle-orm';
import type { Field } from '@laburauto/shared';

interface ContractContext {
  publisherId?: number;
  renterId?: number;
  vehicleId?: number;
  bookingId?: number;
}

interface VariableSchema {
  [category: string]: {
    [key: string]: {
      type: string;
      label: string;
      path: string;
    };
  };
}

/**
 * Resolves variable values from the database based on the context
 */
export async function resolveVariables(
  variableSchema: VariableSchema,
  context: ContractContext,
  providedDb?: any
): Promise<Record<string, any>> {
  const activeDb = (providedDb || db) as any;
  const resolvedValues: Record<string, any> = {};

  // Fetch data based on context
  let publisherData = null;
  let renterData = null;
  let vehicleData = null;
  let bookingData = null;

  if (context.publisherId) {
    publisherData = await activeDb.query.users.findFirst({
      where: eq(usersTable.id, context.publisherId),
    });
  }

  if (context.renterId) {
    renterData = await activeDb.query.users.findFirst({
      where: eq(usersTable.id, context.renterId),
    });
  }

  if (context.vehicleId) {
    vehicleData = await activeDb.query.vehicles.findFirst({
      where: eq(vehiclesTable.id, context.vehicleId),
      with: { vehicleModel: true },
    });
  }

  if (context.bookingId) {
    bookingData = await activeDb.query.bookings.findFirst({
      where: eq(bookingsTable.id, context.bookingId),
    });
  }

  /**
   * Helper to get value from a path like 'renter.name' or 'vehicle.plate'
   */
  const getValueByPath = (path: string) => {
    const [category, key] = path.split('.');

    if (category === 'publisher') return publisherData?.[key as keyof typeof publisherData];
    if (category === 'renter') return renterData?.[key as keyof typeof renterData];
    if (category === 'vehicle') return vehicleData?.[key as keyof typeof vehicleData];
    if (category === 'booking') return bookingData?.[key as keyof typeof bookingData];
    if (category === 'vehicleModel') return vehicleData?.vehicleModel?.[key as keyof typeof vehicleData.vehicleModel];

    // Legacy / Generic users category (falls back to publisher then renter)
    if (category === 'users') return publisherData?.[key as keyof typeof publisherData] || renterData?.[key as keyof typeof renterData];

    return null;
  };

  // Build resolved values from schema
  for (const category in variableSchema) {
    for (const key in variableSchema[category]) {
      const varDef = variableSchema[category][key];
      const varPath = `${category}.${key}`;
      const dbPath = varDef.path;

      const value = getValueByPath(dbPath);
      resolvedValues[varPath] = value !== undefined && value !== null ? value : '';
    }
  }

  return resolvedValues;
}

/**
 * Replaces variable placeholders in fields with actual values
 */
export function replaceVariablesInFields(
  fields: Field[],
  variableValues: Record<string, any>
): Field[] {
  return fields.map(field => {
    if (field.type === 'variable' && field.value.includes('{{')) {
      let finalValue = field.value;

      // Find all matches for {{...}}
      const matches = finalValue.match(/{{([^}]+)}}/g);
      if (matches) {
        for (const match of matches) {
          const varPath = match.replace(/{{|}}/g, '').trim();
          const actualValue = variableValues[varPath];
          finalValue = finalValue.replace(match, actualValue !== undefined ? String(actualValue) : '');
        }
      }

      return {
        ...field,
        value: finalValue,
      };
    }
    return field;
  });
}

/**
 * Creates a contract instance from a template with resolved variables
 */
export async function createContractInstance(
  templateId: number,
  context: ContractContext,
  providedDb?: any
) {
  const activeDb = (providedDb || db) as any;
  // 1. Fetch template
  const template = await activeDb.query.contractTemplates.findFirst({
    where: eq(contractTemplates.id, templateId),
  });

  if (!template) {
    throw new Error('Template not found');
  }

  // 2. Resolve variables if schema exists
  let variableValues: Record<string, any> = {};
  let processedFields = template.fields;

  if (template.variableSchema) {
    variableValues = await resolveVariables(
      template.variableSchema as VariableSchema,
      context,
      activeDb
    );
    processedFields = replaceVariablesInFields(template.fields, variableValues);
  }

  // 3. Create contract instance
  const [instance] = await activeDb.insert(contractInstances).values({
    templateId: template.id,
    variableValues,
    publisherId: context.publisherId,
    renterId: context.renterId,
    bookingId: context.bookingId,
    status: 'pending',
    auditLog: [],
  }).returning();

  return {
    ...instance,
    fields: processedFields,
    stages: template.stages,
  };
}

/**
 * Gets a contract instance with pre-filled fields
 */
export async function getContractInstance(instanceId: number, providedDb?: any) {
  const activeDb = (providedDb || db) as any;
  const instance = await activeDb.query.contractInstances.findFirst({
    where: eq(contractInstances.id, instanceId),
    with: { template: true },
  });

  if (!instance) {
    throw new Error('Contract instance not found');
  }

  // Apply variable values to fields
  const processedFields = instance.variableValues
    ? replaceVariablesInFields(
      instance.template.fields,
      instance.variableValues as Record<string, any>
    )
    : instance.template.fields;

  return {
    ...instance,
    fields: processedFields,
    stages: instance.template.stages,
  };
}
