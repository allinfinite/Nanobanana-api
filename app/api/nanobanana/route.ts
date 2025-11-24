import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { message, history, apiKey: userApiKey, aspectRatio } = await req.json();

        const apiKey = userApiKey || process.env.GEMINI_API_SECRET;

        if (!apiKey) {
            return NextResponse.json(
                { error: "API Key is required. Please provide it in the UI or set GEMINI_API_SECRET in .env.local" },
                { status: 400 }
            );
        }

        if (!message) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });

        // Validate and normalize history format
        const normalizedHistory = (history || []).map((item: any) => {
            // Ensure parts is an array
            let parts = item.parts;
            if (!Array.isArray(parts)) {
                parts = [{ text: String(parts || "") }];
            }
            
            // For model messages, filter out inlineData (not allowed by API)
            if (item.role === "model") {
                parts = parts.filter((part: any) => part.text && !part.inlineData);
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

        // Append aspect ratio instruction to the message since it's not supported in config for this model
        const promptWithAspectRatio = aspectRatio ? `${message} (Aspect Ratio: ${aspectRatio})` : message;

        const result = await chat.sendMessage(promptWithAspectRatio);
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
