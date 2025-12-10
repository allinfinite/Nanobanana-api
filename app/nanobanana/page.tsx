"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Send, Key, Bot, User, Loader2, Image as ImageIcon, Download, Paperclip, X, RefreshCw, Layers, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "model";
    parts: any; // Store full parts structure to preserve thought signatures
    images?: { mimeType: string; data: string; label?: string }[];
}

const STYLE_PRESETS = [
    "Modern Minimalist",
    "Bold & Colorful",
    "Corporate Professional",
    "Creative/Artistic",
    "Dark Mode",
    "Light & Airy",
    "Tech Startup",
    "Elegant Luxury",
];

export default function NanobananaPage() {
    const [apiKey, setApiKey] = useState("");
    const [input, setInput] = useState("");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadedImages, setUploadedImages] = useState<{ mimeType: string; data: string }[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // New state for styles and multiple generation
    const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
    const [customStyle, setCustomStyle] = useState("");
    const [generateMultiple, setGenerateMultiple] = useState(false);
    const [numVariations, setNumVariations] = useState(3);
    const [currentPreset, setCurrentPreset] = useState<string | null>(null);
    const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; label?: string } | null>(null);

    // Load API key from local storage on mount
    useEffect(() => {
        const storedKey = localStorage.getItem("gemini_api_key");
        if (storedKey) setApiKey(storedKey);
    }, []);

    // Save API key to local storage
    const handleSaveKey = (key: string) => {
        setApiKey(key);
        localStorage.setItem("gemini_api_key", key);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Helper function to compress/resize image
    const compressImage = (file: File, maxWidth: number = 1920, maxHeight: number = 1920, quality: number = 0.8): Promise<{ mimeType: string; data: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('Could not get canvas context'));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert to base64
                    const mimeType = file.type || 'image/jpeg';
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Failed to compress image'));
                                return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => {
                                const base64 = reader.result as string;
                                const data = base64.split(",")[1];
                                resolve({ mimeType, data });
                            };
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        },
                        mimeType,
                        quality
                    );
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const imagePromises = Array.from(files).map((file) => {
            // Compress images to reduce payload size
            return compressImage(file);
        });

        try {
            const images = await Promise.all(imagePromises);
            setUploadedImages((prev) => [...prev, ...images]);
        } catch (error) {
            console.error("Error reading images:", error);
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveImage = (index: number) => {
        setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleRegenerate = async () => {
        if (messages.length < 2) return; // Need at least one user message and one model response

        // Find the last user message
        let lastUserMessage: Message | null = null;
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
                lastUserMessage = messages[i];
                break;
            }
        }

        if (!lastUserMessage) return;

        // Remove the last model response
        setMessages((prev) => {
            const newMessages = [...prev];
            // Remove last message if it's from model
            if (newMessages[newMessages.length - 1].role === "model") {
                newMessages.pop();
            }
            return newMessages;
        });

        setIsLoading(true);

        try {
            // Get history without the last model response
            // Filter out inlineData from model messages (not allowed by API) but preserve thought_signatures
            const history = messages.slice(0, -1).map(m => {
                let parts = m.parts;
                
                // Ensure parts is an array
                if (!Array.isArray(parts)) {
                    parts = [{ text: parts }];
                }
                
                // For model messages, filter out inlineData parts (only keep text parts) but preserve thought_signatures
                if (m.role === "model") {
                    parts = parts
                        .filter((part: any) => part.text && !part.inlineData)
                        .map((part: any) => {
                            // Preserve all properties from the original part, especially thought_signature
                            const textPart: any = { ...part };
                            // Ensure we only keep text-related properties, remove inlineData if present
                            delete textPart.inlineData;
                            return textPart;
                        });
                    // If no text parts remain, create a placeholder text part
                    if (parts.length === 0) {
                        parts = [{ text: "Image generated successfully." }];
                    }
                }
                
                return {
                    role: m.role,
                    parts: parts
                };
            });

            // Extract message parts from last user message (base message without prefix)
            let messageParts: any[] = [];
            let baseMessage = "";
            
            if (Array.isArray(lastUserMessage.parts)) {
                messageParts = lastUserMessage.parts;
                const textParts = messageParts.filter((part: any) => part.text);
                baseMessage = textParts.length > 0 ? textParts[0].text : "";
            } else {
                baseMessage = String(lastUserMessage.parts || "");
            }
            
            // Get preset prefix from currentPreset (same logic as handleSubmit)
            const presetList = [
                { label: "Flyer", prefix: "A professional flyer design for" },
                { label: "Video Cover", prefix: "A YouTube video thumbnail for" },
                { label: "Featured Image", prefix: "A blog post featured image for" },
                { label: "Advertisement", prefix: "An eye-catching advertisement for" },
                { label: "Infographic", prefix: "An educational infographic about" },
                { label: "Social Media", prefix: "A social media post graphic for" },
                { label: "Logo", prefix: "A minimalist logo design for" },
                { label: "Product Shot", prefix: "A professional product photography shot of" },
                { label: "Landing Page", prefix: "A modern landing page mockup for" },
                { label: "Website Homepage", prefix: "A professional website homepage design for" },
                { label: "Product Page", prefix: "An e-commerce product page layout for" },
                { label: "About Page", prefix: "A company about page design for" },
                { label: "Portfolio", prefix: "A creative portfolio website layout for" },
                { label: "SaaS Landing", prefix: "A SaaS product landing page for" },
                { label: "Blog Layout", prefix: "A blog homepage design for" },
                { label: "Dashboard", prefix: "A web application dashboard mockup for" },
            ];
            
            const selectedPreset = presetList.find(p => p.label === currentPreset);
            const presetPrefix = selectedPreset?.prefix;
            const separator = ": ";
            const userMessage = presetPrefix ? `${presetPrefix}${separator}${baseMessage}` : baseMessage;

            const response = await fetch("/api/nanobanana", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    messageParts: Array.isArray(lastUserMessage.parts) ? messageParts : undefined,
                    history,
                    apiKey,
                    aspectRatio,
                }),
            });

            // Check if response is OK before parsing JSON
            if (!response.ok) {
                let errorMessage = "Failed to generate image";
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If response is not JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                    // Provide user-friendly message for 413 errors
                    if (response.status === 413) {
                        errorMessage = "Image file is too large. Please use a smaller image or compress it before uploading.";
                    }
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            const responseParts = data.candidates?.[0]?.content?.parts || [];
            const generatedImages = responseParts
                .filter((part: any) => part.inlineData)
                .map((part: any) => part.inlineData);

            setMessages((prev) => [
                ...prev,
                {
                    role: "model",
                    parts: responseParts,
                    images: generatedImages.length > 0 ? generatedImages : undefined
                }
            ]);

        } catch (error: any) {
            const errorMessage = error.message || "An unexpected error occurred";
            setMessages((prev) => [
                ...prev,
                { role: "model", parts: `❌ ${errorMessage}` },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper function to build prompt with style
    const buildPrompt = (baseMessage: string, presetPrefix?: string, label?: string): string => {
        let prompt = baseMessage;
        
        // Apply preset prefix if provided (input field no longer contains prefix)
        const separator = ": ";
        if (presetPrefix) {
            prompt = `${presetPrefix}${separator}${prompt}`;
        }
        
        // Build style string
        const styleParts: string[] = [];
        if (selectedStyles.length > 0) {
            styleParts.push(...selectedStyles);
        }
        if (customStyle.trim()) {
            styleParts.push(customStyle.trim());
        }
        const styleString = styleParts.length > 0 ? styleParts.join(", ") : undefined;
        
        // Build final prompt with explicit dimension instructions
        let finalPrompt = prompt;
        if (styleString) {
            finalPrompt = `${finalPrompt} | Style: ${styleString}`;
        }
        if (aspectRatio) {
            // Map aspect ratios to explicit dimension instructions
            const dimensionMap: { [key: string]: string } = {
                "1536:150": "CRITICAL: Generate a VERY WIDE, THIN horizontal banner image exactly 1536 pixels wide by 150 pixels tall. This is for a video footer/lower third. The image MUST be ultra-wide and very short in height.",
                "16:9": "Generate a wide landscape image with 16:9 aspect ratio (1920x1080 or similar widescreen format).",
                "9:16": "Generate a tall vertical image with 9:16 aspect ratio (1080x1920 or similar mobile/portrait format).",
                "4:3": "Generate a standard landscape image with 4:3 aspect ratio (1024x768 or similar).",
                "3:4": "Generate a portrait image with 3:4 aspect ratio (768x1024 or similar).",
                "1:1": "Generate a square image with 1:1 aspect ratio (equal width and height)."
            };
            
            const dimensionInstruction = dimensionMap[aspectRatio] || `Generate image with aspect ratio: ${aspectRatio}`;
            finalPrompt = `${dimensionInstruction}\n\n${finalPrompt}`;
        }
        
        return finalPrompt;
    };

    // Helper function to make API call
    const makeApiCall = async (prompt: string, history: any[], label?: string, images?: { mimeType: string; data: string }[]): Promise<{ images: { mimeType: string; data: string; label?: string }[]; responseParts: any[] }> => {
        const messageParts: any[] = [{ text: prompt }];
        // Only include images if explicitly provided (new uploads)
        // Don't re-send images from conversation history - they're already there
        const imagesToUse = images && images.length > 0 ? images : [];
        imagesToUse.forEach((img) => {
            messageParts.push({ inlineData: img });
        });

        const response = await fetch("/api/nanobanana", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: prompt,
                messageParts: messageParts.length > 0 ? messageParts : undefined,
                history,
                apiKey,
                aspectRatio,
            }),
        });

            // Check if response is OK before parsing JSON
            if (!response.ok) {
                let errorMessage = "Failed to generate image";
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    // If response is not JSON, use status text
                    errorMessage = response.statusText || errorMessage;
                    // Provide user-friendly message for 413 errors
                    if (response.status === 413) {
                        errorMessage = "Image file is too large. Please use a smaller image or compress it before uploading.";
                    }
                }
                throw new Error(errorMessage);
            }

        const data = await response.json();

        const responseParts = data.candidates?.[0]?.content?.parts || [];
        const generatedImages = responseParts
            .filter((part: any) => part.inlineData)
            .map((part: any) => ({
                ...part.inlineData,
                label: label
            }));

        return { images: generatedImages, responseParts };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() && uploadedImages.length === 0) return;

        const userMessage = input.trim();
        
        // Check if Full Website Set preset is selected
        const isFullWebsiteSet = currentPreset === "Full Website Set";
        
        // Get preset prefix from currentPreset (not from input field)
        const presetList = [
            { label: "Flyer", prefix: "A professional flyer design for" },
            { label: "Video Cover", prefix: "A YouTube video thumbnail for" },
            { label: "Featured Image", prefix: "A blog post featured image for" },
            { label: "Advertisement", prefix: "An eye-catching advertisement for" },
            { label: "Infographic", prefix: "An educational infographic about" },
            { label: "Social Media", prefix: "A social media post graphic for" },
            { label: "Logo", prefix: "A minimalist logo design for" },
            { label: "Product Shot", prefix: "A professional product photography shot of" },
            { label: "Landing Page", prefix: "A modern landing page mockup for" },
            { label: "Website Homepage", prefix: "A professional website homepage design for" },
            { label: "Product Page", prefix: "An e-commerce product page layout for" },
            { label: "About Page", prefix: "A company about page design for" },
            { label: "Portfolio", prefix: "A creative portfolio website layout for" },
            { label: "SaaS Landing", prefix: "A SaaS product landing page for" },
            { label: "Blog Layout", prefix: "A blog homepage design for" },
            { label: "Dashboard", prefix: "A web application dashboard mockup for" },
        ];
        
        const selectedPreset = presetList.find(p => p.label === currentPreset);
        const presetPrefix = selectedPreset?.prefix;
        const baseMessage = userMessage; // Input field only contains user's message, no prefix

        // Build message parts with text and images for user message display
        const messageParts: any[] = [];
        if (userMessage) {
            messageParts.push({ text: userMessage });
        }
        // Only include images if there are new uploads (not when just replying)
        const currentUploadedImages = uploadedImages.length > 0 ? [...uploadedImages] : [];
        currentUploadedImages.forEach((img) => {
            messageParts.push({ inlineData: img });
        });

        setInput("");
        setUploadedImages([]);
        setIsLoading(true);
        setGenerationProgress(null);

        // Add user message
        setMessages((prev) => [
            ...prev,
            {
                role: "user",
                parts: messageParts,
                images: currentUploadedImages.length > 0 ? currentUploadedImages : undefined
            }
        ]);

        try {
            // Convert messages to Gemini format for history
            // Exclude images from history to reduce payload size - images are already processed
            const history = messages.map(m => {
                let parts = m.parts;
                
                if (!Array.isArray(parts)) {
                    parts = [{ text: parts }];
                }
                
                if (m.role === "user") {
                    // For user messages, only include text parts in history (exclude images to reduce payload)
                    // Images are already in the conversation context from previous messages
                    parts = parts
                        .filter((part: any) => part.text && !part.inlineData)
                        .map((part: any) => {
                            const textPart: any = { ...part };
                            delete textPart.inlineData;
                            return textPart;
                        });
                    // Ensure at least one text part exists
                    if (parts.length === 0) {
                        parts = [{ text: "" }];
                    }
                } else if (m.role === "model") {
                    // Filter out inlineData but preserve all text parts with their thought_signatures
                    const textParts = parts
                        .filter((part: any) => part.text && !part.inlineData)
                        .map((part: any) => {
                            const textPart: any = { ...part };
                            delete textPart.inlineData;
                            return textPart;
                        });
                    
                    // If no text parts exist, check if we can extract thought_signature from any part
                    if (textParts.length === 0) {
                        // Look for thought_signature in any part (even if it has inlineData)
                        const thoughtSignature = parts.find((part: any) => part.thoughtSignature)?.thoughtSignature;
                        if (thoughtSignature) {
                            // Create a text part with the thought_signature
                            parts = [{ text: "Image generated successfully.", thoughtSignature }];
                        } else {
                            // No thought_signature found, create placeholder
                            parts = [{ text: "Image generated successfully." }];
                        }
                    } else {
                        parts = textParts;
                    }
                }
                
                return {
                    role: m.role,
                    parts: parts
                };
            });

            let allGeneratedImages: { mimeType: string; data: string; label?: string }[] = [];
            let allResponseParts: any[] = [];

            if (isFullWebsiteSet) {
                // Generate 3 mockups: Landing, Blog, Product in the same style
                // Use fresh history for each call to avoid confusion
                const prompts = [
                    { prompt: buildPrompt(baseMessage, "Create a modern landing page mockup for"), label: "Landing Page" },
                    { prompt: buildPrompt(baseMessage, "Create a blog homepage design layout for"), label: "Blog" },
                    { prompt: buildPrompt(baseMessage, "Create an e-commerce product page layout for"), label: "Product Page" },
                ];

                for (let i = 0; i < prompts.length; i++) {
                    setGenerationProgress({ current: i + 1, total: 3, label: prompts[i].label });
                    // Use fresh history (only user messages, no previous model responses from this batch)
                    // This ensures each prompt generates the correct page type
                    const freshHistory = messages.filter(m => m.role === "user").map(m => {
                        let parts = m.parts;
                        if (!Array.isArray(parts)) {
                            parts = [{ text: parts }];
                        }
                        return {
                            role: m.role,
                            parts: parts.filter((part: any) => part.text || part.inlineData)
                        };
                    });
                    // Only pass images if there are new uploads
                    const result = await makeApiCall(prompts[i].prompt, freshHistory, prompts[i].label, currentUploadedImages.length > 0 ? currentUploadedImages : undefined);
                    allGeneratedImages.push(...result.images);
                    allResponseParts.push(...result.responseParts);
                }
            } else if (generateMultiple) {
                // Generate multiple variations
                // If multiple styles selected, generate variations for each style
                // Otherwise, generate multiple variations of the same prompt
                const stylesToUse = selectedStyles.length > 0 ? selectedStyles : (customStyle.trim() ? [customStyle.trim()] : [null]);
                const totalGenerations = stylesToUse.length * numVariations;
                
                let generationCount = 0;
                for (const style of stylesToUse) {
                    // Temporarily set style for this generation
                    const originalSelected = [...selectedStyles];
                    const originalCustom = customStyle;
                    
                    if (style) {
                        if (STYLE_PRESETS.includes(style)) {
                            setSelectedStyles([style]);
                            setCustomStyle("");
                        } else {
                            setSelectedStyles([]);
                            setCustomStyle(style);
                        }
                    }
                    
                    for (let i = 0; i < numVariations; i++) {
                        generationCount++;
                        setGenerationProgress({ current: generationCount, total: totalGenerations });
                        const prompt = buildPrompt(baseMessage, presetPrefix);
                        // Only pass images if there are new uploads
                        const result = await makeApiCall(prompt, history, undefined, currentUploadedImages.length > 0 ? currentUploadedImages : undefined);
                        allGeneratedImages.push(...result.images);
                        // Store response parts from the last call (for thought_signature preservation)
                        if (i === numVariations - 1) {
                            allResponseParts = result.responseParts;
                        }
                    }
                    
                    // Restore original styles
                    setSelectedStyles(originalSelected);
                    setCustomStyle(originalCustom);
                }
            } else {
                // Single generation
                setGenerationProgress({ current: 1, total: 1 });
                const prompt = buildPrompt(baseMessage, presetPrefix);
                // Only pass images if there are new uploads
                const result = await makeApiCall(prompt, history, undefined, currentUploadedImages.length > 0 ? currentUploadedImages : undefined);
                allGeneratedImages = result.images;
                allResponseParts = result.responseParts;
            }

            // Store the full response parts to preserve thought_signatures
            // If we have response parts, use them; otherwise create a placeholder
            const responsePartsToStore = allResponseParts.length > 0 
                ? allResponseParts 
                : [{ text: isFullWebsiteSet ? "Full website set generated successfully." : "Image generated successfully." }];

            setMessages((prev) => [
                ...prev,
                {
                    role: "model",
                    parts: responsePartsToStore,
                    images: allGeneratedImages.length > 0 ? allGeneratedImages : undefined
                }
            ]);

        } catch (error: any) {
            const errorMessage = error.message || "An unexpected error occurred";
            setMessages((prev) => [
                ...prev,
                { role: "model", parts: `❌ ${errorMessage}` },
            ]);
        } finally {
            setIsLoading(false);
            setGenerationProgress(null);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Header />

            <main className="flex-1 container mx-auto p-4 flex flex-col max-w-4xl">
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-bold text-gradient mb-1">Nanobanana Pro Chat</h1>
                    <p className="text-sm text-muted-foreground">Conversational AI Image Generation</p>
                </div>

                {/* API Key Input */}
                <Card className="mb-4 p-4 flex items-center gap-4 bg-secondary/50 border-none">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <Input
                        type="password"
                        placeholder="Enter API Key (Optional if configured on server)"
                        value={apiKey}
                        onChange={(e) => handleSaveKey(e.target.value)}
                        className="bg-transparent border-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground/50"
                    />
                </Card>

                {/* Chat Area */}
                <Card className="flex-1 flex flex-col overflow-hidden glass border-none shadow-2xl min-h-[500px]">
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                <ImageIcon className="h-16 w-16 mb-4" />
                                <p>Describe an image to start generating</p>
                            </div>
                        )}

                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "flex items-start gap-3 max-w-[90%]",
                                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                                )}
                            >
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                        msg.role === "user" ? "bg-accent" : "bg-secondary"
                                    )}
                                >
                                    {msg.role === "user" ? (
                                        <User className="h-4 w-4 text-white" />
                                    ) : (
                                        <Bot className="h-4 w-4 text-accent" />
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div
                                        className={cn(
                                            "p-3 rounded-2xl text-sm",
                                            msg.role === "user"
                                                ? "bg-accent text-white rounded-tr-none"
                                                : "bg-secondary text-secondary-foreground rounded-tl-none"
                                        )}
                                    >
                                        {Array.isArray(msg.parts)
                                            ? msg.parts
                                                .filter((part: any) => part.text)
                                                .map((part: any) => part.text)
                                                .join("\n") || (msg.images?.length ? "Image generated successfully." : "")
                                            : msg.parts
                                        }
                                    </div>

                                    {/* Render Images if present */}
                                    {msg.images && (
                                        <div className={cn(
                                            "mt-2",
                                            msg.images.length > 1 && "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                                        )}>
                                            {msg.images.map((img, imgIndex) => (
                                                <div key={imgIndex} className="relative">
                                                    {img.label && (
                                                        <div className="text-xs text-muted-foreground mb-2 font-medium">
                                                            {img.label}
                                                        </div>
                                                    )}
                                                    <div className="relative group">
                                                        <img
                                                            src={`data:${img.mimeType};base64,${img.data}`}
                                                            alt={img.label || "Generated Art"}
                                                            className="max-w-full rounded-lg shadow-lg border border-white/10 w-full"
                                                        />
                                                        {/* Desktop hover overlay */}
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center gap-4 rounded-lg">
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const link = document.createElement('a');
                                                                    link.href = `data:${img.mimeType};base64,${img.data}`;
                                                                    const filename = img.label 
                                                                        ? `nanobanana-${img.label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`
                                                                        : `nanobanana-${Date.now()}.jpg`;
                                                                    link.download = filename;
                                                                    document.body.appendChild(link);
                                                                    link.click();
                                                                    document.body.removeChild(link);
                                                                }}
                                                            >
                                                                <Download className="mr-2 h-4 w-4" /> Download
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {/* Mobile: Download button below image - always visible and easy to tap */}
                                                    <div className="md:hidden mt-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                                const link = document.createElement('a');
                                                                link.href = `data:${img.mimeType};base64,${img.data}`;
                                                                const filename = img.label 
                                                                    ? `nanobanana-${img.label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`
                                                                    : `nanobanana-${Date.now()}.jpg`;
                                                                link.download = filename;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                            }}
                                                            className="w-full"
                                                        >
                                                            <Download className="mr-2 h-4 w-4" /> Download {img.label || "Image"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* Download All button for multiple images */}
                                            {msg.images.length > 1 && msg.role === "model" && index === messages.length - 1 && (
                                                <div className="col-span-full mt-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            msg.images?.forEach((img, idx) => {
                                                                setTimeout(() => {
                                                                    const link = document.createElement('a');
                                                                    link.href = `data:${img.mimeType};base64,${img.data}`;
                                                                    const filename = img.label 
                                                                        ? `nanobanana-${img.label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${idx}.jpg`
                                                                        : `nanobanana-${Date.now()}-${idx}.jpg`;
                                                                    link.download = filename;
                                                                    document.body.appendChild(link);
                                                                    link.click();
                                                                    document.body.removeChild(link);
                                                                }, idx * 100);
                                                            });
                                                        }}
                                                        className="w-full"
                                                    >
                                                        <Download className="mr-2 h-4 w-4" /> Download All ({msg.images.length})
                                                    </Button>
                                                </div>
                                            )}
                                            {/* Show regenerate button only on last model message */}
                                            {msg.role === "model" && index === messages.length - 1 && msg.images.length === 1 && (
                                                <div className="col-span-full">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleRegenerate}
                                                        disabled={isLoading}
                                                        className="mt-2 w-full"
                                                    >
                                                        <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-muted-foreground ml-11">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-xs">
                                    {generationProgress 
                                        ? `Generating ${generationProgress.current}/${generationProgress.total}${generationProgress.label ? ` - ${generationProgress.label}` : ''}...`
                                        : "Generating image..."}
                                </span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-black/20 border-t border-white/5 flex flex-col gap-4">
                        {/* Style Selector */}
                        <div className="flex flex-col gap-2">
                            <div className="text-xs text-muted-foreground font-medium">Style Presets</div>
                            <div className="flex flex-wrap gap-2">
                                {STYLE_PRESETS.map((style) => (
                                    <Button
                                        key={style}
                                        type="button"
                                        variant={selectedStyles.includes(style) ? "secondary" : "outline"}
                                        size="sm"
                                        onClick={() => {
                                            setSelectedStyles((prev) =>
                                                prev.includes(style)
                                                    ? prev.filter((s) => s !== style)
                                                    : [...prev, style]
                                            );
                                        }}
                                        className={cn(
                                            "text-xs h-8",
                                            selectedStyles.includes(style) && "bg-accent text-white border-accent"
                                        )}
                                    >
                                        {selectedStyles.includes(style) && <Check className="mr-1 h-3 w-3" />}
                                        {style}
                                    </Button>
                                ))}
                            </div>
                            <Input
                                type="text"
                                placeholder="Or enter custom style..."
                                value={customStyle}
                                onChange={(e) => setCustomStyle(e.target.value)}
                                className="bg-secondary/50 border-none focus-visible:ring-1 focus-visible:ring-accent/50 text-xs h-8"
                            />
                        </div>

                        {/* Generate Multiple Toggle */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="generate-multiple"
                                checked={generateMultiple}
                                onChange={(e) => setGenerateMultiple(e.target.checked)}
                                className="w-4 h-4 rounded border-white/20 bg-secondary/50"
                            />
                            <label htmlFor="generate-multiple" className="text-xs text-muted-foreground cursor-pointer">
                                Generate Multiple
                            </label>
                            {generateMultiple && (
                                <div className="flex items-center gap-2 ml-4">
                                    <span className="text-xs text-muted-foreground">Variations:</span>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="5"
                                        value={numVariations}
                                        onChange={(e) => setNumVariations(Math.max(1, Math.min(5, parseInt(e.target.value) || 1)))}
                                        className="w-16 h-8 bg-secondary/50 border-none focus-visible:ring-1 focus-visible:ring-accent/50 text-xs"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Preset Buttons */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {[
                                { label: "Flyer", prefix: "A professional flyer design for" },
                                { label: "Video Cover", prefix: "A YouTube video thumbnail for" },
                                { label: "Featured Image", prefix: "A blog post featured image for" },
                                { label: "Advertisement", prefix: "An eye-catching advertisement for" },
                                { label: "Infographic", prefix: "An educational infographic about" },
                                { label: "Social Media", prefix: "A social media post graphic for" },
                                { label: "Logo", prefix: "A minimalist logo design for" },
                                { label: "Product Shot", prefix: "A professional product photography shot of" },
                                { label: "Landing Page", prefix: "A modern landing page mockup for" },
                                { label: "Website Homepage", prefix: "A professional website homepage design for" },
                                { label: "Product Page", prefix: "An e-commerce product page layout for" },
                                { label: "About Page", prefix: "A company about page design for" },
                                { label: "Portfolio", prefix: "A creative portfolio website layout for" },
                                { label: "SaaS Landing", prefix: "A SaaS product landing page for" },
                                { label: "Blog Layout", prefix: "A blog homepage design for" },
                                { label: "Dashboard", prefix: "A web application dashboard mockup for" },
                                { label: "Full Website Set", prefix: "Full Website Set", isSpecial: true },
                            ].map((preset) => (
                                <Button
                                    key={preset.label}
                                    type="button"
                                    variant={currentPreset === preset.label ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        // Just set the preset, don't modify the input field
                                        // The prefix will be added when sending to Gemini
                                        if (preset.isSpecial) {
                                            setCurrentPreset(preset.label);
                                        } else {
                                            // Clear any existing prefix from input if switching presets
                                            const separator = ": ";
                                            const currentInput = input;
                                            const content = currentInput.includes(separator)
                                                ? currentInput.split(separator).slice(1).join(separator)
                                                : currentInput;
                                            setInput(content);
                                            setCurrentPreset(preset.label);
                                        }
                                    }}
                                    className={cn(
                                        "whitespace-nowrap bg-secondary/30 hover:bg-accent hover:text-white border-white/10 text-xs",
                                        currentPreset === preset.label && "bg-accent text-white border-accent",
                                        preset.isSpecial && "bg-primary/20 border-primary/50"
                                    )}
                                >
                                    {preset.isSpecial && <Layers className="mr-1 h-3 w-3" />}
                                    {preset.label}
                                </Button>
                            ))}
                        </div>

                        <div className="flex gap-2 justify-center mb-2 flex-wrap">
                            {[
                                { ratio: "1:1", label: "Square", width: 24, height: 24 },
                                { ratio: "16:9", label: "Wide", width: 32, height: 18 },
                                { ratio: "9:16", label: "Tall", width: 18, height: 32 },
                                { ratio: "4:3", label: "Standard", width: 28, height: 21 },
                                { ratio: "3:4", label: "Portrait", width: 21, height: 28 },
                                { ratio: "1536:150", label: "Video Footer", width: 34, height: 3 },
                            ].map((item) => (
                                <Button
                                    key={item.ratio}
                                    type="button"
                                    variant={aspectRatio === item.ratio ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setAspectRatio(item.ratio)}
                                    className={cn(
                                        "h-10 w-12 p-0 flex items-center justify-center transition-all",
                                        aspectRatio === item.ratio ? "bg-accent text-white ring-2 ring-accent/50" : "text-muted-foreground hover:text-white hover:bg-white/10"
                                    )}
                                    title={item.label}
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        <svg
                                            width="24"
                                            height="24"
                                            viewBox="0 0 36 36"
                                            className={cn("fill-current", aspectRatio === item.ratio ? "text-white" : "text-muted-foreground")}
                                        >
                                            <rect
                                                x={18 - item.width / 2}
                                                y={18 - item.height / 2}
                                                width={item.width}
                                                height={item.height}
                                                rx="2"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                fill="none"
                                            />
                                        </svg>
                                    </div>
                                </Button>
                            ))}
                        </div>
                        {/* Image Upload Previews */}
                        {uploadedImages.length > 0 && (
                            <div className="flex gap-2 flex-wrap pb-2">
                                {uploadedImages.map((img, index) => (
                                    <div key={index} className="relative group">
                                        <img
                                            src={`data:${img.mimeType};base64,${img.data}`}
                                            alt={`Upload ${index + 1}`}
                                            className="h-20 w-20 object-cover rounded-lg border border-white/10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveImage(index)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading}
                                className="shrink-0 text-muted-foreground hover:text-white hover:bg-white/10 px-2"
                            >
                                <Paperclip className="h-4 w-4" />
                            </Button>
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={
                                    currentPreset && currentPreset !== "Full Website Set"
                                        ? `Describe ${currentPreset.toLowerCase()}...`
                                        : "Describe the image you want to generate or edit..."
                                }
                                className="flex-1 bg-secondary/50 border-none focus-visible:ring-1 focus-visible:ring-accent/50"
                                disabled={isLoading}
                            />
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-accent hover:bg-accent/90 text-white"
                            >
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </div>
                </Card>
            </main>
        </div>
    );
}
