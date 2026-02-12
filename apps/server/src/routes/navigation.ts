import { Router } from 'express';


const router = Router();
const apiKey = process.env.GEOAPIFY_API_KEY || '';

// Types (simplified from navigation.service.ts)
type AutocompleteItem = { title: string; lat: number; lng: number; address?: string };

// Helper function to fetch from Geoapify
async function fetchGeoapify(url: string) {
  console.log(`[Navigation] Fetching: ${url}`);
  const response = await fetch(url);
  return await response.json();
}

// Search / Autocomplete Address
router.get('/search', async (req, res) => {
  const text = req.query.text as string;
  if (!text) return res.status(400).json({ error: 'Text query is required' });

  try {
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&limit=5&format=json&apiKey=${apiKey}`;
    const json: any = await fetchGeoapify(url);

    const results = (json.results || []).map((r: any) => ({
      title: r.formatted || r.address_line1,
      address: r.formatted,
      lat: r.lat,
      lng: r.lon
    }));

    res.json({ results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search address' });
  }
});

// Reverse Geocoding
router.get('/reverse', async (req, res) => {
  const lat = req.query.lat as string;
  const lng = req.query.lng as string;

  if (!lat || !lng) return res.status(400).json({ error: 'Lat and Lng are required' });

  try {
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${apiKey}&format=json`;
    const json: any = await fetchGeoapify(url);

    // Return the first/best result
    const first = json.results?.[0];
    const address = first ? (first.formatted || first.name) : 'Unknown location';

    res.json({
      address,
      details: first
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reverse geocode' });
  }
});

export default router;
