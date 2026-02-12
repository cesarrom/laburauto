interface VehicleInferenceResult {
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  confidence: number;
}

export async function inferVehicleFromImage(imageUrl: string): Promise<VehicleInferenceResult> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://laburauto.com', // Replace with your actual domain
        'X-Title': 'Laburauto Vehicle Detection'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o', // Vision-capable model
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this vehicle image and extract the following information in JSON format:
                {
                  "make": "vehicle manufacturer",
                  "model": "vehicle model name",
                  "year": estimated year (number),
                  "color": "primary color",
                  "confidence": confidence score from 0-1
                }
                
                If you cannot determine a field with confidence, omit it from the response. Only return the JSON object, nothing else.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const result = JSON.parse(jsonMatch[0]) as VehicleInferenceResult;

    return {
      make: result.make,
      model: result.model,
      year: result.year,
      color: result.color,
      confidence: result.confidence || 0.5,
    };
  } catch (error) {
    console.error('OpenRouter inference error:', error);
    throw new Error('Failed to infer vehicle information');
  }
}
