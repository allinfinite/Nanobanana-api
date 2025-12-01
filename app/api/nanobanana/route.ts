import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 60;
export const runtime = 'nodejs';

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
                        // Preserve all properties from the original part, especially thought_signature
                        const textPart: any = { ...part };
                        // Ensure we only keep text-related properties, remove inlineData if present
                        delete textPart.inlineData;
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
        // Note: Aspect ratio and styles are now included in the prompt by the client
        let partsToSend: any[];
        if (messageParts && Array.isArray(messageParts)) {
            // Use provided messageParts as-is (styles and aspect ratio already included in prompt)
            partsToSend = messageParts;
        } else {
            // Fallback to text message (for backward compatibility)
            partsToSend = [{ text: message }];
        }

        const result = await chat.sendMessage(partsToSend);
        const response = await result.response;

        return NextResponse.json({
            success: true,
            candidates: response.candidates
        });

    } catch (error: any) {
        console.error("Nanobanana API Error:", error);
        
        // Provide user-friendly error messages
        let errorMessage = error.message || "Something went wrong";
        let statusCode = 500;
        
        // Check for API key errors
        if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
            errorMessage = "Invalid API key. Please check your API key and try again.";
            statusCode = 401;
        } else if (errorMessage.includes("API key")) {
            errorMessage = "API key error. Please verify your API key is correct.";
            statusCode = 401;
        }
        
        return NextResponse.json(
            { error: errorMessage },
            { status: statusCode }
        );
    }
}
