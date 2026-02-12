import { Router } from 'express';
import { db } from '../db';
import { vehicles, shifts, users, notifications, publisherDocuments, vehicleModels } from '@laburauto/shared';
import { eq, inArray } from 'drizzle-orm';
import { getSignedUrl } from '../services/bytescale';
import { AuditService } from '../services/auditService';
import { requireAuth, requireRole, requireOwnership } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { publishVehicleSchema } from '@laburauto/shared/zod';

const router = Router();

// Get all vehicles (with shifts and model info)
router.get('/', async (req, res) => {
  const { publisherId, status } = req.query;

  try {
    let whereClause;

    if (publisherId) {
      // If publisherId specified, show ONLY that publisher's vehicles (any status)
      whereClause = eq(vehicles.publisherId, parseInt(publisherId as string));
    } else if (status) {
      // If status specified (e.g., from admin), filter by that status
      whereClause = eq(vehicles.status, status as any);
    } else {
      // For general listing, show only active vehicles
      whereClause = eq(vehicles.status, 'active');
    }

    const results = await db.query.vehicles.findMany({
      where: whereClause,
      with: {
        shifts: true,
        vehicleModel: true,
        publisher: {
          columns: {
            id: true,
            name: true,
            email: true,
            paymentDetails: true,
          }
        }
      }
    });

    // Fetch publisher documents for these vehicles
    const vehicleIds = results.map(v => v.id);
    let docsMap: Record<number, any> = {};

    if (vehicleIds.length > 0) {
      const docs = await db.select().from(publisherDocuments).where(inArray(publisherDocuments.vehicleId, vehicleIds));
      docsMap = docs.reduce((acc: any, d: any) => {
        acc[d.vehicleId] = d;
        return acc;
      }, {});
    }

    // Transform for frontend compatibility
    const mapped = results.map(v => {
      let photos: string[] = [];
      try {
        photos = v.photos ? v.photos : [];
        // Sign photo URLs
        photos = photos.map((url: string) => getSignedUrl(url));
      } catch (e) { }

      let documentUrls: string[] = [];
      try {
        documentUrls = v.documentUrls ? v.documentUrls : [];
        // Sign document URLs
        documentUrls = documentUrls.map((url: string) => getSignedUrl(url));
      } catch (e) { }

      const doc = docsMap[v.id] || {};

      return {
        ...v,
        make: v.vehicleModel?.brandName || 'Unknown',
        model: v.vehicleModel?.modelName || 'Unknown',
        version: v.vehicleModel?.versionName,
        photos,
        documentUrls, // Signed URLs
        imageUrl: photos[0] || null, // Fallback for list view
        // Add specific documents for frontend modal
        registrationCertificate: doc.registrationCertificate ? getSignedUrl(doc.registrationCertificate) : null,
        proofOfInsurance: doc.proofOfInsurance ? getSignedUrl(doc.proofOfInsurance) : null,
        technicalInspection: doc.technicalInspection ? getSignedUrl(doc.technicalInspection) : null,
      };
    });

    res.json(mapped);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get vehicle by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, parseInt(id as string)),
      with: {
        shifts: true,
        vehicleModel: true,
        publisher: {
          columns: {
            id: true,
            email: true,
            paymentDetails: true,
          }
        }
      }
    });

    if (!result) return res.status(404).json({ error: 'Vehicle not found' });

    // Fetch publisher documents for this vehicle
    const doc = await db.query.publisherDocuments.findFirst({
      where: eq(publisherDocuments.vehicleId, result.id)
    });

    let photos: string[] = [];
    try {
      photos = result.photos || [];
      // Sign photo URLs
      photos = photos.map((url: string) => getSignedUrl(url));
    } catch (e) { }

    let documentUrls: string[] = [];
    try {
      documentUrls = result.documentUrls || [];
      // Sign URLs if they are private paths
      documentUrls = documentUrls.map((url: string) => getSignedUrl(url));
    } catch (e) { }

    // Obscure location for privacy (Fuzzy Location)
    // Add random offset within ~500m radius (approx 0.0045 deg)
    // In a real app, this should be consistent (hashed) or stored, otherwise it jumps on every refresh.
    // For now we'll do simple truncation or fixed offset based on ID to be stable.
    const fuzzOffset = (n: number) => (n % 100) / 10000; // Deterministic-ish based on ID

    const mapped = {
      ...result,
      make: result.vehicleModel?.brandName || 'Unknown',
      model: result.vehicleModel?.modelName || 'Unknown',
      version: result.vehicleModel?.versionName,
      photos,
      documentUrls, // Signed
      imageUrl: photos[0] || null,

      // Privacy: Remove exact location
      idleLat: undefined,
      idleLong: undefined,
      idleAddress: undefined,

      // Return fuzzy location
      approxLat: (result.idleLat || 0) + fuzzOffset(result.id),
      approxLng: (result.idleLong || 0) + fuzzOffset(result.id + 50),
      radius: 800, // meters

      // Add specific documents for frontend modal
      registrationCertificate: doc?.registrationCertificate ? getSignedUrl(doc.registrationCertificate) : null,
      proofOfInsurance: doc?.proofOfInsurance ? getSignedUrl(doc.proofOfInsurance) : null,
      technicalInspection: doc?.technicalInspection ? getSignedUrl(doc.technicalInspection) : null,
    };

    res.json(mapped);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create vehicle - requires publisher role
router.post('/', requireAuth, requireRole('publisher'), validateRequest({ body: publishVehicleSchema }), async (req, res) => {
  // Use authenticated user's ID, not body.publisherId
  const publisherId = req.user!.id;
  const {
    vehicleModelId,
    year,
    plate,
    mileage,
    color,
    description,
    photos,
    documentUrls,
    idleLat,
    idleLong,
    idleAddress,
    accessInstructions,
    paymentInstructions,
    registrationCertificate,
    proofOfInsurance,
    technicalInspection,
    shifts: shiftsData
  } = req.body;

  try {


    // Validate required payment instructions
    if (!paymentInstructions) {
      return res.status(400).json({ error: 'Payment instructions are required' });
    }


    // [SECURITY] Check Subscription Status
    const publisher = await db.query.users.findFirst({
      where: eq(users.id, publisherId),
      columns: { subscriptionStatus: true }
    });


    if (!publisher) {
      console.error('DEBUG: publishVehicle failed 404 - publisher not found');
      return res.status(404).json({ error: 'Publisher not found' });
    }

    if (publisher.subscriptionStatus !== 'active') {
      return res.status(403).json({
        error: 'Active subscription required to publish vehicles',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }



    const [newVehicle] = await db.insert(vehicles).values({
      publisherId,
      vehicleModelId,
      year,
      plate,
      mileage,
      color,
      description,
      photos,
      documentUrls,
      status: 'pending_review',
      idleLat,
      idleLong,
      idleAddress,
      accessInstructions,
      paymentInstructions,
    }).returning();

    if (shiftsData && Array.isArray(shiftsData) && shiftsData.length > 0) {
      console.error('DEBUG: inserting shifts', shiftsData.length);
      const shiftInserts = shiftsData.map((s: any) => ({
        vehicleId: newVehicle.id,
        type: s.type,
        price: s.price,
        startTime: s.startTime,
        endTime: s.endTime,
      }));
      const insertResult = await db.insert(shifts).values(shiftInserts);
      console.error('DEBUG: shifts insert result success');
    }


    // Insert publisher documents
    if (registrationCertificate || proofOfInsurance || technicalInspection) {
      await db.insert(publisherDocuments).values({
        publisherId,
        vehicleId: newVehicle.id,
        registrationCertificate: registrationCertificate || '',
        proofOfInsurance: proofOfInsurance || '',
        technicalInspection: technicalInspection || '',
      });
    }

    AuditService.log(publisherId, 'vehicle.create', 'vehicle', newVehicle.id, { plate }, req);

    // Manually fetch shifts and model for the response to ensure stability
    const vehicleShifts = await db.select().from(shifts).where(eq(shifts.vehicleId, newVehicle.id));
    const model = await db.query.vehicleModels.findFirst({
      where: eq(vehicleModels.id, newVehicle.vehicleModelId) // user imported the missing dep while tests ran
    });

    const responseVehicle = {
      ...newVehicle,
      shifts: vehicleShifts,
      vehicleModel: model
    };

    res.status(201).json(responseVehicle);






  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Update vehicle photos and documents (only for pending_review vehicles)
router.put('/:id/media', async (req, res) => {
  const { id } = req.params;
  const { publisherId, photos, documentUrls, description, paymentInstructions, accessInstructions } = req.body;

  try {
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, parseInt(id as string)),
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    if (vehicle.publisherId !== publisherId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (vehicle.status !== 'pending_review') {
      return res.status(400).json({ error: 'Can only edit vehicles pending review' });
    }

    const updateData: any = {};

    if (photos !== undefined) {
      const photosArray = Array.isArray(photos) ? photos : JSON.parse(photos);
      updateData.photos = JSON.stringify(photosArray);
    }
    if (documentUrls !== undefined) {
      const docsArray = Array.isArray(documentUrls) ? documentUrls : JSON.parse(documentUrls);
      updateData.documentUrls = JSON.stringify(docsArray);
    }
    if (description !== undefined) {
      updateData.description = description;
    }
    if (paymentInstructions !== undefined) {
      updateData.paymentInstructions = paymentInstructions;
    }
    if (accessInstructions !== undefined) {
      updateData.accessInstructions = accessInstructions;
    }

    const [updatedVehicle] = await db.update(vehicles)
      .set(updateData)
      .where(eq(vehicles.id, parseInt(id as string)))
      .returning();

    AuditService.log(publisherId, 'vehicle.update', 'vehicle', updatedVehicle.id, { fields: Object.keys(updateData) }, req);
    res.json(updatedVehicle);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add shift to vehicle
router.post('/:id/shifts', async (req, res) => {
  const { id } = req.params;
  const { type, price, startTime, endTime } = req.body;
  try {
    const [newShift] = await db.insert(shifts).values({
      vehicleId: parseInt(id as string),
      type,
      price,
      startTime,
      endTime,
    }).returning();
    res.status(201).json(newShift);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Vehicle Approval - requires admin role
router.put('/:id/approve', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const reviewedBy = req.user!.id; // Use authenticated admin's ID

  try {
    const [vehicle] = await db.update(vehicles)
      .set({
        status: 'active',
        reviewedAt: new Date(),
        reviewedBy,
      })
      .where(eq(vehicles.id, parseInt(id as string)))
      .returning();

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Notify publisher
    await db.insert(notifications).values({
      userId: vehicle.publisherId,
      type: 'vehicle_approved',
      message: `Your vehicle (${vehicle.plate}) has been approved and is now active!`,
      relatedEntityId: vehicle.id,
    });

    AuditService.log(reviewedBy || null, 'vehicle.approved', 'vehicle', vehicle.id, {}, req);
    res.json(vehicle);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject vehicle - requires admin role
router.put('/:id/reject', requireAuth, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const reviewedBy = req.user!.id; // Use authenticated admin's ID
  const { reason } = req.body || {};

  try {
    const [vehicle] = await db.update(vehicles)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy,
        rejectionReason: reason,
      })
      .where(eq(vehicles.id, parseInt(id as string)))
      .returning();

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Notify publisher
    await db.insert(notifications).values({
      userId: vehicle.publisherId,
      type: 'vehicle_rejected',
      message: `Your vehicle (${vehicle.plate}) was not approved. Reason: ${reason}`,
      relatedEntityId: vehicle.id,
    });

    AuditService.log(reviewedBy || null, 'vehicle.rejected', 'vehicle', vehicle.id, { reason }, req);
    res.json(vehicle);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Maintenance Mode - requires auth + ownership
router.put('/:id/maintenance', requireAuth, async (req, res) => {
  const { id } = req.params;
  const publisherId = req.user!.id; // Use authenticated user's ID

  try {
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, parseInt(id as string)),
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    if (vehicle.publisherId !== publisherId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [updatedVehicle] = await db.update(vehicles)
      .set({ status: 'maintenance' })
      .where(eq(vehicles.id, parseInt(id as string)))
      .returning();

    // TODO: Cancel future bookings with refunds

    AuditService.log(publisherId, 'vehicle.maintenance_mode', 'vehicle', updatedVehicle.id, {}, req);
    res.json(updatedVehicle);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reactivate vehicle - requires auth + ownership
router.put('/:id/reactivate', requireAuth, async (req, res) => {
  const { id } = req.params;
  const publisherId = req.user!.id; // Use authenticated user's ID

  try {
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, parseInt(id as string)),
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    if (vehicle.publisherId !== publisherId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [updatedVehicle] = await db.update(vehicles)
      .set({ status: 'active' })
      .where(eq(vehicles.id, parseInt(id as string)))
      .returning();

    AuditService.log(publisherId, 'vehicle.reactivate', 'vehicle', updatedVehicle.id, {}, req);
    res.json(updatedVehicle);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
