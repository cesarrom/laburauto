# Laburauto Integration Setup

## Overview
This document explains the external service integrations used in Laburauto.

## Required API Keys

### 1. OpenRouter (AI Vehicle Detection)
**Purpose**: Automatically detect vehicle make, model, year, and color from uploaded photos.

**Setup**:
1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Go to [API Keys](https://openrouter.ai/keys)
3. Create a new API key
4. Add to `.env` as `OPENROUTER_API_KEY=sk-or-v1-...`

**Models Used**: `openai/gpt-4o` (vision-capable model)

**Cost**: Pay-per-use based on OpenRouter pricing

---

### 2. Bytescale (File Upload)
**Purpose**: Upload and store vehicle photos and ownership documents securely.

**Setup**:
1. Sign up at [Bytescale](https://www.bytescale.com/)
2. Create a new account/project
3. Get your API key from [Dashboard](https://www.bytescale.com/dashboard)
4. Add to `.env` as `BYTESCALE_API_KEY=public_...`

**Features Used**:
- Image upload with automatic optimization
- PDF document storage
- CDN delivery

**Storage Limits**: Check your Bytescale plan

---

## API Endpoints

### File Upload
- **POST** `/api/upload/upload` - Single file upload
- **POST** `/api/upload/upload-multiple` - Multiple files upload (up to 10)

### AI Inference
- **POST** `/api/ai/infer-vehicle` - Detect vehicle info from image URL

---

## Best Practices

### Security
- ✅ API keys stored in environment variables (never in code)
- ✅ File type validation (images and PDFs only)
- ✅ File size limits (10MB max)
- ✅ Multer memory storage for efficient processing

### Error Handling
- ✅ Graceful degradation if AI fails
- ✅ User-friendly error messages
- ✅ Console logging for debugging

### Performance
- ✅ Parallel file uploads when possible
- ✅ Bytescale CDN for fast image delivery
- ✅ AI inference only on first photo (not all photos)

---

## Testing Without API Keys

If you don't have API keys yet:
1. File uploads will fail - you can skip photo upload steps temporarily
2. AI inference will fail - manually enter vehicle details instead

The wizard is designed to work without AI - users can always enter vehicle info manually.

---

## Cost Optimization

### OpenRouter
- Only call AI on user request (explicit button click)
- Use lower temperature (0.3) for consistent results
- Limit max_tokens to 300
- Consider caching results per image URL

### Bytescale
- Optimize image sizes before upload
- Set appropriate file size limits
- Monitor storage usage in dashboard

---

## Troubleshooting

### "Upload failed"
- Check BYTESCALE_API_KEY is set correctly
- Verify file is under 10MB
- Check file type is image/* or application/pdf

### "Failed to detect vehicle"
- Check OPENROUTER_API_KEY is valid
- Verify image URL is publicly accessible
- Check OpenRouter account has credits

---

## Environment Variables Summary

```bash
# Required for production
OPENROUTER_API_KEY=sk-or-v1-...
BYTESCALE_API_KEY=public_...
JWT_SECRET=random-secure-string
DATABASE_URL=postgres://...

# Optional
PORT=3000
```
