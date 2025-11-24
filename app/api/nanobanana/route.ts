import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { message, messageParts, history, apiKey: userApiKey, aspectRatio } = await req.json();

        const apiKey = userApiKey || process.env.GEMINI_API_SECRET;

        if (!apiKey) {
            return NextResponse.json(
                { error: "API Key is required. Please provide it in the UI or set GEMINI_API_SECRET in .env.local" },
                { status: 400 }
            );
        }

        if (!message && !messageParts) {
            return NextResponse.json(
                { error: "Message or messageParts is required" },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });

        // Validate and normalize history format - preserve thought_signatures
        const normalizedHistory = (history || []).map((item: any) => {
            // Ensure parts is an array
            let parts = item.parts;
            if (!Array.isArray(parts)) {
                parts = [{ text: String(parts || "") }];
            }
            
            // For model messages, filter out inlineData (not allowed by API) but preserve thought_signatures
            if (item.role === "model") {
                parts = parts
                    .filter((part: any) => part.text && !part.inlineData)
                    .map((part: any) => {
                        // Preserve thought_signature if it exists
                        const textPart: any = { text: part.text };
                        if (part.thought_signature) {
                            textPart.thought_signature = part.thought_signature;
                        }
                        return textPart;
                    });
                // Ensure at least one text part exists
                if (parts.length === 0) {
                    parts = [{ text: "Image generated successfully." }];
                }
            }
            
            return {
                role: item.role,
                parts: parts
            };
        });

        const chat = model.startChat({
            history: normalizedHistory,
        });

        // Build message parts - use messageParts if provided, otherwise create from message text
        let partsToSend: any[];
        if (messageParts && Array.isArray(messageParts)) {
            // Use provided messageParts, append aspect ratio to text parts if needed
            partsToSend = messageParts.map((part: any) => {
                if (part.text && aspectRatio) {
                    return { ...part, text: `${part.text} (Aspect Ratio: ${aspectRatio})` };
                }
                return part;
            });
        } else {
            // Fallback to text message
            const promptWithAspectRatio = aspectRatio ? `${message} (Aspect Ratio: ${aspectRatio})` : message;
            partsToSend = [{ text: promptWithAspectRatio }];
        }

        const result = await chat.sendMessage(partsToSend);
        const response = await result.response;

        return NextResponse.json({
            success: true,
            candidates: response.candidates
        });

    } catch (error: any) {
        console.error("Nanobanana API Error:", error);
        return NextResponse.json(
            { error: error.message || "Something went wrong" },
            { status: 500 }
        );
    }
}
