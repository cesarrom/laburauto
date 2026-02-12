import { Router } from 'express';
import multer from 'multer';
import { uploadFile, uploadMultipleFiles, getSignedUrl } from '../services/bytescale';

const router = Router();

// Configure multer to use memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images and PDFs only
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'));
    }
  },
});

// Upload single file
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileUrl = await uploadFile(req.file);

    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Upload multiple files
router.post('/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const type = req.query.type as string || req.body.type || 'general';
    const folder = type === 'kyc' ? 'private_documents' : (type === 'vehicle' ? 'public_vehicles' : 'uploads');

    // Store RAW paths in DB (never expire)
    // Frontend will sign them when displaying
    const filePaths = await uploadMultipleFiles(req.files, folder);

    res.json({
      success: true,
      urls: filePaths, // Return raw paths for storage
      count: filePaths.length
    });
  } catch (error) {
    console.error('Multiple upload error:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

export default router;
