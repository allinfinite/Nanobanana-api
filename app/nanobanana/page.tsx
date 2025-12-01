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

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const imagePromises = Array.from(files).map((file) => {
            return new Promise<{ mimeType: string; data: string }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result as string;
                    const data = base64.split(",")[1]; // Remove data:image/...;base64, prefix
                    resolve({ mimeType: file.type, data });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
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

            // Extract message parts from last user message
            let messageParts: any[] = [];
            let userMessage = "";
            
            if (Array.isArray(lastUserMessage.parts)) {
                messageParts = lastUserMessage.parts;
                const textParts = messageParts.filter((part: any) => part.text);
                userMessage = textParts.length > 0 ? textParts[0].text : "";
            } else {
                userMessage = String(lastUserMessage.parts || "");
            }

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
        
        // Extract content after separator if preset is already applied
        const separator = ": ";
        if (prompt.includes(separator)) {
            const parts = prompt.split(separator);
            if (parts.length > 1) {
                prompt = parts.slice(1).join(separator);
            }
        }
        
        // Apply preset prefix if provided
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
        
        // Build final prompt
        let finalPrompt = prompt;
        if (styleString) {
            finalPrompt = `${finalPrompt} | Style: ${styleString}`;
        }
        if (aspectRatio) {
            finalPrompt = `${finalPrompt} | Aspect Ratio: ${aspectRatio}`;
        }
        
        return finalPrompt;
    };

    // Helper function to make API call
    const makeApiCall = async (prompt: string, history: any[], label?: string, images?: { mimeType: string; data: string }[]): Promise<{ mimeType: string; data: string; label?: string }[]> => {
        const messageParts: any[] = [{ text: prompt }];
        const imagesToUse = images || uploadedImages;
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

        return generatedImages;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() && uploadedImages.length === 0) return;

        const userMessage = input.trim();
        const separator = ": ";
        
        // Check if Full Website Set preset is selected
        const isFullWebsiteSet = currentPreset === "Full Website Set";
        
        // Extract preset prefix if present (but not for Full Website Set)
        let presetPrefix: string | undefined;
        let baseMessage = userMessage;
        if (!isFullWebsiteSet && userMessage.includes(separator)) {
            const parts = userMessage.split(separator);
            presetPrefix = parts[0];
            baseMessage = parts.slice(1).join(separator);
        } else if (isFullWebsiteSet) {
            // For Full Website Set, use the entire message as base
            baseMessage = userMessage;
        }

        // Build message parts with text and images for user message display
        const messageParts: any[] = [];
        if (userMessage) {
            messageParts.push({ text: userMessage });
        }
        const currentUploadedImages = [...uploadedImages];
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
            const history = messages.map(m => {
                let parts = m.parts;
                
                if (!Array.isArray(parts)) {
                    parts = [{ text: parts }];
                }
                
                if (m.role === "model") {
                    parts = parts
                        .filter((part: any) => part.text && !part.inlineData)
                        .map((part: any) => {
                            const textPart: any = { ...part };
                            delete textPart.inlineData;
                            return textPart;
                        });
                    if (parts.length === 0) {
                        parts = [{ text: "Image generated successfully." }];
                    }
                }
                
                return {
                    role: m.role,
                    parts: parts
                };
            });

            let allGeneratedImages: { mimeType: string; data: string; label?: string }[] = [];

            if (isFullWebsiteSet) {
                // Generate 3 mockups: Landing, Blog, Product in the same style
                const prompts = [
                    { prompt: buildPrompt(baseMessage, "A modern landing page mockup for"), label: "Landing Page" },
                    { prompt: buildPrompt(baseMessage, "A blog homepage design for"), label: "Blog" },
                    { prompt: buildPrompt(baseMessage, "An e-commerce product page layout for"), label: "Product Page" },
                ];

                for (let i = 0; i < prompts.length; i++) {
                    setGenerationProgress({ current: i + 1, total: 3, label: prompts[i].label });
                    const images = await makeApiCall(prompts[i].prompt, history, prompts[i].label, currentUploadedImages);
                    allGeneratedImages.push(...images);
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
                        const images = await makeApiCall(prompt, history, undefined, currentUploadedImages);
                        allGeneratedImages.push(...images);
                    }
                    
                    // Restore original styles
                    setSelectedStyles(originalSelected);
                    setCustomStyle(originalCustom);
                }
            } else {
                // Single generation
                setGenerationProgress({ current: 1, total: 1 });
                const prompt = buildPrompt(baseMessage, presetPrefix);
                const images = await makeApiCall(prompt, history, undefined, currentUploadedImages);
                allGeneratedImages = images;
            }

            setMessages((prev) => [
                ...prev,
                {
                    role: "model",
                    parts: [{ text: isFullWebsiteSet ? "Full website set generated successfully." : "Image generated successfully." }],
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
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 rounded-lg">
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
                                        if (preset.isSpecial) {
                                            // Full Website Set - clear any preset prefix from input, just set the preset
                                            const separator = ": ";
                                            const currentInput = input;
                                            const content = currentInput.includes(separator)
                                                ? currentInput.split(separator).slice(1).join(separator)
                                                : currentInput;
                                            setInput(content);
                                            setCurrentPreset(preset.label);
                                        } else {
                                            const separator = ": ";
                                            const currentInput = input;
                                            const content = currentInput.includes(separator)
                                                ? currentInput.split(separator).slice(1).join(separator)
                                                : currentInput;

                                            setInput(`${preset.prefix}${separator}${content}`);
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

                        <div className="flex gap-2 justify-center mb-2">
                            {[
                                { ratio: "1:1", label: "Square", width: 24, height: 24 },
                                { ratio: "16:9", label: "Wide", width: 32, height: 18 },
                                { ratio: "9:16", label: "Tall", width: 18, height: 32 },
                                { ratio: "4:3", label: "Standard", width: 28, height: 21 },
                                { ratio: "3:4", label: "Portrait", width: 21, height: 28 },
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
                                placeholder="Describe the image you want to generate or edit..."
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
