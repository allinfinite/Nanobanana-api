"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Send, Key, Bot, User, Loader2, Image as ImageIcon, Download, Paperclip, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "model";
    parts: any; // Store full parts structure to preserve thought signatures
    images?: { mimeType: string; data: string }[];
}

export default function NanobananaPage() {
    const [apiKey, setApiKey] = useState("");
    const [input, setInput] = useState("");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadedImages, setUploadedImages] = useState<{ mimeType: string; data: string }[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                            // Preserve thought_signature if it exists
                            const textPart: any = { text: part.text };
                            if (part.thought_signature) {
                                textPart.thought_signature = part.thought_signature;
                            }
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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to generate image");
            }

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() && uploadedImages.length === 0) return;

        const userMessage = input.trim();

        // Build message parts with text and images
        const messageParts: any[] = [];
        if (userMessage) {
            messageParts.push({ text: userMessage });
        }
        uploadedImages.forEach((img) => {
            messageParts.push({ inlineData: img });
        });

        setInput("");
        setUploadedImages([]);
        setMessages((prev) => [
            ...prev,
            {
                role: "user",
                parts: messageParts,
                images: uploadedImages.length > 0 ? uploadedImages : undefined
            }
        ]);
        setIsLoading(true);

        try {
            // Convert messages to Gemini format for history
            // Filter out inlineData from model messages (not allowed by API) but preserve thought_signatures
            const history = messages.map(m => {
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
                            // Preserve thought_signature if it exists
                            const textPart: any = { text: part.text };
                            if (part.thought_signature) {
                                textPart.thought_signature = part.thought_signature;
                            }
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

            const response = await fetch("/api/nanobanana", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    messageParts: messageParts.length > 0 ? messageParts : undefined,
                    history,
                    apiKey,
                    aspectRatio,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to generate image");
            }

            // Store the full parts array to preserve thought signatures
            const responseParts = data.candidates?.[0]?.content?.parts || [];

            // Extract images for display
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
                                    {msg.images && msg.images.map((img, imgIndex) => (
                                        <div key={imgIndex} className="mt-2">
                                            <div className="relative group">
                                                <img
                                                    src={`data:${img.mimeType};base64,${img.data}`}
                                                    alt="Generated Art"
                                                    className="max-w-full rounded-lg shadow-lg border border-white/10"
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 rounded-lg">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => {
                                                            const link = document.createElement('a');
                                                            link.href = `data:${img.mimeType};base64,${img.data}`;
                                                            link.download = `nanobanana-${Date.now()}.jpg`;
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);
                                                        }}
                                                    >
                                                        <Download className="mr-2 h-4 w-4" /> Download
                                                    </Button>
                                                </div>
                                            </div>
                                            {/* Show regenerate button only on last model message */}
                                            {msg.role === "model" && index === messages.length - 1 && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleRegenerate}
                                                    disabled={isLoading}
                                                    className="mt-2 w-full"
                                                >
                                                    <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-muted-foreground ml-11">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-xs">Generating image...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-black/20 border-t border-white/5 flex flex-col gap-4">
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
                            ].map((preset) => (
                                <Button
                                    key={preset.label}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const separator = ": ";
                                        const currentInput = input;
                                        // If input already has a preset prefix (contains separator), replace it
                                        // Otherwise prepend
                                        const content = currentInput.includes(separator)
                                            ? currentInput.split(separator).slice(1).join(separator)
                                            : currentInput;

                                        setInput(`${preset.prefix}${separator}${content}`);
                                    }}
                                    className="whitespace-nowrap bg-secondary/30 hover:bg-accent hover:text-white border-white/10 text-xs"
                                >
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
