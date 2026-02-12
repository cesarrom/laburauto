import { format } from 'date-fns';

export interface VariableContext {
  publisher?: {
    name: string;
    email: string;
  };
  renter?: {
    name: string;
    email: string;
  };
  vehicle?: {
    make: string;
    model: string;
    plate: string;
  };
  booking?: {
    id: number;
    startDate?: Date;
    endDate?: Date;
  };
  contractId?: number;
}

export class ContractVariableService {
  /**
   * Resolves {{variables}} in a string based on context
   */
  static resolve(text: string, context: VariableContext): string {
    const now = new Date();

    const replacements: Record<string, string | undefined> = {
      'publisher_name': context.publisher?.name,
      'publisher_email': context.publisher?.email,
      'renter_name': context.renter?.name,
      'renter_email': context.renter?.email,
      'vehicle_make': context.vehicle?.make,
      'vehicle_model': context.vehicle?.model,
      'vehicle_plate': context.vehicle?.plate,
      'booking_id': context.booking?.id?.toString(),
      'contract_id': context.contractId?.toString(),
      'date_full': format(now, 'PPPP'),
      'date_short': format(now, 'dd/MM/yyyy'),
      'date_iso': now.toISOString().split('T')[0],
    };

    return text.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
      const value = replacements[key.trim()];
      return value !== undefined ? value : match;
    });
  }

  /**
   * Processes all fields in a contract instance and resolves variables
   */
  static processFields(fields: any[], context: VariableContext): any[] {
    return fields.map(field => {
      if (field.type === 'variable') {
        const resolvedValue = this.resolve(field.label, context);
        return { ...field, value: resolvedValue };
      }
      return field;
    });
  }
}
