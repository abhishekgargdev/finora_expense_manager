/**
 * Gemini AI Service with API Key Rotation
 */

function getApiKeys(): string[] {
  const keys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
  ]
    .map((k) => k?.trim())
    .filter(Boolean) as string[];

  // Fallback to standard key if none of the numbered keys are set
  if (keys.length === 0 && process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY.trim());
  }

  return keys;
}

export interface GenerateOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Calls the Gemini API to generate content.
 * Automatically rotates between configured API keys if rate-limited (HTTP 429) or on transient server errors.
 */
export async function generateContent(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error(
      "No Gemini API keys configured. Please define GEMINI_API_KEY_1 through GEMINI_API_KEY_6 in .env.local."
    );
  }

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const { systemPrompt, temperature = 0.4, maxTokens = 2048 } = options;

  let lastError: Error | null = null;

  // Try each key sequentially
  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Construct request body
    const body: {
      contents: Array<{
        role: string;
        parts: Array<{ text: string }>;
      }>;
      generationConfig: {
        temperature: number;
        maxOutputTokens: number;
      };
      systemInstruction?: {
        parts: Array<{ text: string }>;
      };
    } = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    if (systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // If we get rate-limited (429) or transient error (5xx), we try the next key
        const statusCode = response.status;
        const errorMessage = data?.error?.message || response.statusText || "Unknown error";
        
        console.warn(
          `Gemini API request failed using key index ${i + 1} with Status ${statusCode}: ${errorMessage}. Rotating key...`
        );
        
        lastError = new Error(`Gemini API (Key index ${i + 1}): [${statusCode}] ${errorMessage}`);
        
        if (statusCode === 429 || statusCode >= 500) {
          continue; // Rotate to next key
        } else {
          // Non-retryable error (e.g. 400 Bad Request, 403 Invalid API Key, etc.)
          throw lastError;
        }
      }

      // Extract generated text from response
      const candidates = data?.candidates || [];
      if (candidates.length === 0 || !candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error("Invalid response format received from Gemini API (empty candidates).");
      }

      return candidates[0].content.parts[0].text;
    } catch (error) {
      if (error instanceof Error) {
        lastError = error;
      } else {
        lastError = new Error(String(error));
      }
      
      console.warn(`Exception occurred with key index ${i + 1}: ${lastError.message}. Rotating key...`);
    }
  }

  // If we loop through all keys and fail
  throw new Error(`All Gemini API keys failed. Last error: ${lastError?.message}`);
}
