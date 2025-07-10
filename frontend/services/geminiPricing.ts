// Gemini API pricing and cost computation utility

export const GEMINI_25_PRO = "gemini-2.5-pro";
export const GEMINI_25_FLASH_LITE_PREVIEW_0617 = "gemini-2.5-flash-lite-preview-06-17";
export const GEMINI_25_FLASH = "gemini-2.5-flash";
export const GEMINI_20_FLASH = "gemini-2.0-flash";

export type GeminiModelKey =
  | typeof GEMINI_25_PRO
  | typeof GEMINI_25_FLASH_LITE_PREVIEW_0617
  | typeof GEMINI_25_FLASH
  | typeof GEMINI_20_FLASH;

interface GeminiPricing {
  [model: string]: {
    pricing: {
      input: Record<string, number>;
      output: Record<string, number> | number;
    };
    unit: string;
  };
}

export const gemini_api_pricing: GeminiPricing = {
  "gemini-2.5-pro": {
    pricing: {
      input: { "<=200k_tokens": 1.25, ">200k_tokens": 2.5 },
      output: { "<=200k_tokens": 10.0, ">200k_tokens": 15.0 }
    },
    unit: "per 1 million tokens"
  },
  "gemini-2.5-flash-lite-preview-06-17": {
    pricing: {
      input: { default: 0.10, audio: 0.50 },
      output: 0.40
    },
    unit: "per 1 million tokens"
  },
  "gemini-2.5-flash": {
    pricing: {
      input: { default: 0.30, audio: 1.00 },
      output: 2.50
    },
    unit: "per 1 million tokens"
  },
  "gemini-2.0-flash": {
    pricing: {
      input: { default: 0.10, audio: 0.70 },
      output: 0.40
    },
    unit: "per 1 million tokens"
  }
};

// Cost per Google Search grounding (adjust as needed)
const GROUNDING_SEARCH_COST = 0.035; // USD per search

export function computeGeminiCost(
  model: GeminiModelKey,
  inputTokens: number,
  outputTokens: number,
  inputType: "default" | "audio" = "default",
  groundingSearches: number = 0
): number {
  const pricing = gemini_api_pricing[model]?.pricing;
  if (!pricing) return 0;

  // Input cost
  let inputCostPerM = 0;
  if (model === "gemini-2.5-pro") {
    inputCostPerM = inputTokens <= 200_000 ? pricing.input["<=200k_tokens"] : pricing.input[">200k_tokens"];
  } else {
    inputCostPerM = pricing.input[inputType] ?? pricing.input["default"];
  }
  const inputCost = (inputTokens / 1_000_000) * inputCostPerM;

  // Output cost
  let outputCostPerM = 0;
  if (model === "gemini-2.5-pro") {
    outputCostPerM = outputTokens <= 200_000 ? (pricing.output as any)["<=200k_tokens"] : (pricing.output as any)[">200k_tokens"];
  } else if (typeof pricing.output === "number") {
    outputCostPerM = pricing.output;
  } else {
    outputCostPerM = (pricing.output as any)["default"] ?? 0;
  }
  const outputCost = (outputTokens / 1_000_000) * outputCostPerM;

  // Grounding (Google Search) cost
  const groundingCost = groundingSearches * GROUNDING_SEARCH_COST;

  const total = +(inputCost + outputCost + groundingCost).toFixed(4); // USD, rounded to 4 decimals
  console.log(`[Gemini Pricing] Model: ${model}, InputTokens: ${inputTokens}, OutputTokens: ${outputTokens}, InputType: ${inputType}, Grounding: ${groundingSearches}, Total Cost: $${total}`);
  return total;
}
