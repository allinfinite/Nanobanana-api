
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { message, history, apiKey: userApiKey, model = "gemini-pro" } = await req.json();

        const apiKey = userApiKey || process.env.GEMINI_API_SECRET;

        if (!apiKey) {
            return NextResponse.json(
                { error: "API Key is required. Please provide it in the UI or set GEMINI_API_SECRET in .env.local" },
                { status: 400 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const genModel = genAI.getGenerativeModel({ model });

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
                    parts = [{ text: "" }];
                }
            }
            
            return {
                role: item.role,
                parts: parts
            };
        });

        const chat = genModel.startChat({
            history: normalizedHistory,
            generationConfig: {
                maxOutputTokens: 1000,
            },
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const text = response.text();

        return NextResponse.json({ text });
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { error: error.message || "Something went wrong" },
            { status: 500 }
        );
    }
}
