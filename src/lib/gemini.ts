/**
 * AI Service with API Key Rotation and Sequential Chain Generation (Gemini & NVIDIA)
 */

interface ActiveKey {
  provider: "gemini" | "nvidia";
  key: string;
  model: string;
}

function getActiveKeys(): ActiveKey[] {
  const activeKeys: ActiveKey[] = [];

  // 1. Load Gemini Keys
  const geminiModel = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const geminiKeys = [
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
  if (geminiKeys.length === 0 && process.env.GEMINI_API_KEY) {
    geminiKeys.push(process.env.GEMINI_API_KEY.trim());
  }

  for (const key of geminiKeys) {
    activeKeys.push({ provider: "gemini", key, model: geminiModel });
  }

  // 2. Load NVIDIA Keys
  const nvidiaModel = process.env.NVIDIA_MODEL || "meta/llama-3.2-11b-vision-instruct";
  const nvidiaKeys = [
    process.env.NVIDIA_API_KEY_1,
    process.env.NVIDIA_API_KEY_2,
    process.env.NVIDIA_API_KEY_3,
    process.env.NVIDIA_API_KEY_4,
    process.env.NVIDIA_API_KEY_5,
    process.env.NVIDIA_API_KEY_6,
  ]
    .map((k) => k?.trim())
    .filter(Boolean) as string[];

  // Fallback to standard key if none of the numbered keys are set
  if (nvidiaKeys.length === 0 && process.env.NVIDIA_API_KEY) {
    nvidiaKeys.push(process.env.NVIDIA_API_KEY.trim());
  }

  for (const key of nvidiaKeys) {
    activeKeys.push({ provider: "nvidia", key, model: nvidiaModel });
  }

  return activeKeys;
}

export interface GenerateOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Safely extracts and parses a JSON object from text that may contain markdown formatting or conversational text.
 */
export function extractJsonObject<T = any>(text: string): T {
  if (!text || !text.trim()) {
    throw new Error("Empty response received from AI model.");
  }

  let cleaned = text.trim();

  // Strip markdown code fences (e.g. ```json ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Locate opening '{' and matching closing '}'
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Fallback regex match for JSON object structure
        const match = cleaned.match(/\{[\s\S]*?\}/);
        if (match) {
          return JSON.parse(match[0]) as T;
        }
      }
    }
    throw new Error("Unable to extract valid JSON object from AI response.");
  }
}

async function callGemini(
  apiKey: string,
  model: string,
  originalPrompt: string,
  cumulativeResponse: string,
  systemPrompt?: string,
  temperature?: number,
  maxTokens?: number
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents: any[] = [];
  if (!cumulativeResponse) {
    contents.push({
      role: "user",
      parts: [{ text: originalPrompt }],
    });
  } else {
    contents.push({
      role: "user",
      parts: [{ text: originalPrompt }],
    });
    contents.push({
      role: "model",
      parts: [{ text: cumulativeResponse }],
    });
    contents.push({
      role: "user",
      parts: [{
        text: "Continue the analysis from where you left off. Do not repeat the previous parts. Provide more deep insights, additional checklist items, or further analysis based on the data. Start directly with the continuation."
      }],
    });
  }

  const body: any = {
    contents,
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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(responseText);
  } catch {
    // Body is non-JSON text
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.message || responseText.trim() || response.statusText || "Unknown Gemini API error";
    throw new Error(`[${response.status}] ${errorMsg}`);
  }

  const candidates = data?.candidates || [];
  if (candidates.length === 0 || !candidates[0]?.content?.parts?.[0]?.text) {
    throw new Error("Invalid response format received from Gemini API (empty candidates).");
  }

  return candidates[0].content.parts[0].text;
}

async function callNvidia(
  apiKey: string,
  model: string,
  originalPrompt: string,
  cumulativeResponse: string,
  systemPrompt?: string,
  temperature?: number,
  maxTokens?: number
): Promise<string> {
  const url = "https://integrate.api.nvidia.com/v1/chat/completions";

  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  if (!cumulativeResponse) {
    messages.push({ role: "user", content: originalPrompt });
  } else {
    messages.push({ role: "user", content: originalPrompt });
    messages.push({ role: "assistant", content: cumulativeResponse });
    messages.push({
      role: "user",
      content: "Continue the analysis from where you left off. Do not repeat the previous parts. Provide more deep insights, additional checklist items, or further analysis based on the data. Start directly with the continuation."
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const responseText = await response.text();
  let data: any = null;
  try {
    data = JSON.parse(responseText);
  } catch {
    // Body is non-JSON text
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || data?.detail || data?.message || responseText.trim() || response.statusText || "Unknown NVIDIA API error";
    throw new Error(`[${response.status}] ${errorMsg}`);
  }

  const choices = data?.choices || [];
  if (choices.length === 0 || !choices[0]?.message?.content) {
    throw new Error("Invalid response format received from NVIDIA API (empty choices).");
  }

  return choices[0].message.content;
}

/**
 * Calls the active API keys sequentially, forwarding previous context to compile a comprehensive analysis.
 * Automatically rotates and skips keys that fail.
 */
export async function generateContent(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  const activeKeys = getActiveKeys();
  if (activeKeys.length === 0) {
    throw new Error(
      "No active Gemini or NVIDIA API keys configured. Please define GEMINI_API_KEY_x or NVIDIA_API_KEY_x in .env.local."
    );
  }

  const { systemPrompt, temperature = 0.4, maxTokens = 2048, jsonMode = false } = options;

  let cumulativeResponse = "";
  let lastError: Error | null = null;
  let successfulCalls = 0;

  // Execute sequentially through all active keys
  for (let i = 0; i < activeKeys.length; i++) {
    const { provider, key, model } = activeKeys[i];
    const keyLabel = `${provider.toUpperCase()} Key index ${i + 1}`;

    try {
      console.log(`Starting generation with ${keyLabel} using model: ${model}...`);

      let chunk = "";
      if (provider === "gemini") {
        chunk = await callGemini(key, model, prompt, cumulativeResponse, systemPrompt, temperature, maxTokens);
      } else {
        chunk = await callNvidia(key, model, prompt, cumulativeResponse, systemPrompt, temperature, maxTokens);
      }

      if (chunk && chunk.trim()) {
        const trimmedChunk = chunk.trim();
        if (cumulativeResponse) {
          cumulativeResponse += "\n\n" + trimmedChunk;
        } else {
          cumulativeResponse = trimmedChunk;
        }
        successfulCalls++;
        console.log(`Successfully generated chunk with ${keyLabel}.`);

        // In JSON mode, return after first successful structured response to prevent concatenating multiple JSON blocks
        if (jsonMode) {
          break;
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`Error using ${keyLabel}: ${errorMsg}. Skipping/Rotating key...`);
      lastError = error instanceof Error ? error : new Error(errorMsg);
    }
  }

  // If we couldn't get a response from any key
  if (successfulCalls === 0) {
    throw new Error(`All configured AI API keys failed. Last error: ${lastError?.message}`);
  }

  return cumulativeResponse;
}

