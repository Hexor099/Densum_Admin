"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function parseBillImageAction(base64Image: string, mimeType: string) {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: "Missing GEMINI_API_KEY environment variable. Please add it to .env.local" };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are an expert inventory assistant for a dental lab. 
      Extract the purchased items and their quantities from the attached bill/receipt image.
      Return ONLY a JSON array of objects, where each object has:
      - "name": (string) the name of the item
      - "qty": (number) the quantity purchased
      
      Make sure it's valid JSON. Do not include markdown code block syntax like \`\`\`json.
    `;

    const imageParts = [
      {
        inlineData: {
          data: base64Image,
          mimeType
        }
      }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    // Clean up potential markdown formatting
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.substring(7);
    if (cleanJson.startsWith('```')) cleanJson = cleanJson.substring(3);
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.substring(0, cleanJson.length - 3);
    
    const parsedData = JSON.parse(cleanJson.trim());
    return { success: true, data: parsedData };
  } catch (error: any) {
    console.error("AI Parsing error:", error);
    return { success: false, error: error.message || "Failed to parse image with AI." };
  }
}
