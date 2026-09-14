// AI hero-image cleanup - shared by the TikTok worker (batch) and the admin
// "Generuj AI hero" button (on-demand, in the web container).
//
// Video frames make soft hero shots (motion blur, compression). Given an
// image-capable key, produce a cleaned-up variant of a chosen frame. The prompt
// pins composition and food so the photo stays truthful - it must still look
// like a phone shot of the actual dish, not an AI render.
//
// Gemini wins over OpenAI when both keys are set (far cheaper). The default
// model is gemini-3.1-flash-image: gemini-2.5-flash-image is shut down 2 X 2026.
import fs from "fs";

export const ENHANCE_PROMPT =
  "Turn this video frame into a clean, appetizing food photo. " +
  "Remove ALL overlaid graphics: captions, titles, subtitles, emojis, stickers, " +
  "watermarks, usernames and any UI elements - reconstruct the food and " +
  "background naturally where they were. " +
  "Remove motion blur and compression artifacts, sharpen details, reduce noise, " +
  "correct white balance and exposure so the dish looks crisp and appetizing. " +
  "Keep the same composition, framing, dishes, ingredients, food quantities and " +
  "background - do not add, remove or restyle any real object in the scene. " +
  "The result must look like a natural, unedited smartphone food photo, " +
  "not an AI render or a stock photo.";

// Reads inputPath (a frame jpg), cleans it up with the configured image model,
// writes the result to outputPath. Returns false when no image key is set;
// throws on an API error.
export async function enhanceHeroToFile(inputPath: string, outputPath: string): Promise<boolean> {
  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: fs.readFileSync(inputPath).toString("base64"),
                  },
                },
                { text: ENHANCE_PROMPT },
              ],
            },
          ],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini image: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const data = parts
      .map((p: any) => p.inlineData?.data ?? p.inline_data?.data)
      .find(Boolean);
    if (!data) throw new Error("Gemini image nie zwrócił obrazu");
    fs.writeFileSync(outputPath, Buffer.from(data, "base64"));
    return true;
  }

  if (process.env.OPENAI_API_KEY) {
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("image", new Blob([fs.readFileSync(inputPath)], { type: "image/jpeg" }), "frame.jpg");
    form.append("prompt", ENHANCE_PROMPT);
    // high fidelity keeps the input photo's look instead of re-imagining it
    form.append("input_fidelity", "high");
    form.append("size", "auto");
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });
    if (!res.ok) throw new Error(`gpt-image-1: ${res.status} ${await res.text()}`);
    const json = await res.json();
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("gpt-image-1 nie zwrócił obrazu");
    fs.writeFileSync(outputPath, Buffer.from(b64, "base64"));
    return true;
  }

  return false;
}
