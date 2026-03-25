/**
 * Gemini AI client for content enrichment.
 * Uses Google Generative AI SDK with Gemini 2.0 Flash for fast, cheap enrichment.
 */

import { GoogleGenerativeAI, type GenerationConfig } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const generationConfig: GenerationConfig = {
  temperature: 0.4,
  topP: 0.9,
  maxOutputTokens: 1024,
  responseMimeType: "application/json",
};

export interface EnrichmentInput {
  name: string;
  composerName?: string;
  keySignature?: string;
  instruments?: string[];
  existingDescription?: string;
  existingTags?: string[];
  tempo?: number;
}

export interface EnrichmentResult {
  description: string;
  tags: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  coverPrompt: string;
}

const SYSTEM_PROMPT = `You are a music metadata expert for a sheet music platform called "Backing & Score".
Given metadata about a music piece, generate enriched content in JSON format.

Rules:
- "description": Write 1-2 concise English sentences describing the piece for SEO and social sharing. Mention the composer, the piece's character/mood, and what makes it notable. Do NOT start with "This piece" or "This is".
- "tags": An array of 3-6 relevant tags. Include the primary instrument (e.g., "Piano", "Violin"), genre (e.g., "Classical", "Romantic", "Baroque"), and form (e.g., "Sonata", "Étude", "Prelude"). Use title case.
- "difficulty": Classify as "Beginner", "Intermediate", or "Advanced" based on the piece name, composer, and any available metadata.
- "coverPrompt": A short image generation prompt (20-30 words) to create an artistic album-cover-style image for this piece. Describe mood, colors, and imagery — do NOT include text or letters in the prompt.

Return ONLY valid JSON matching this schema:
{
  "description": "string",
  "tags": ["string"],
  "difficulty": "Beginner" | "Intermediate" | "Advanced",
  "coverPrompt": "string"
}`;

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 36_000; // 36 seconds (API says retry in ~35s)

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function enrichProject(input: EnrichmentInput): Promise<EnrichmentResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig,
    systemInstruction: SYSTEM_PROMPT,
  });

  const userPrompt = buildUserPrompt(input);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(userPrompt);
      const text = result.response.text();

      try {
        const parsed = JSON.parse(text);
        return {
          description: parsed.description || "",
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          difficulty: parsed.difficulty || "Intermediate",
          coverPrompt: parsed.coverPrompt || "",
        };
      } catch {
        throw new Error(`Failed to parse Gemini response: ${text.substring(0, 200)}`);
      }
    } catch (err: any) {
      const is429 = err?.message?.includes("429") || err?.message?.includes("Too Many Requests") || err?.message?.includes("quota");
      if (is429 && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * (attempt + 1);
        console.log(`[AI Enrich] Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }

  throw new Error("Max retries exceeded");
}

function buildUserPrompt(input: EnrichmentInput): string {
  const parts: string[] = [`Piece name: "${input.name}"`];

  if (input.composerName) parts.push(`Composer: ${input.composerName}`);
  if (input.keySignature) parts.push(`Key: ${input.keySignature}`);
  if (input.instruments?.length) parts.push(`Instruments: ${input.instruments.join(", ")}`);
  if (input.tempo) parts.push(`Tempo: ${input.tempo} BPM`);
  if (input.existingTags?.length) parts.push(`Existing tags: ${input.existingTags.join(", ")}`);
  if (input.existingDescription) parts.push(`Current description: ${input.existingDescription}`);

  return parts.join("\n");
}
