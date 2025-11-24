"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Send, Key, Bot, User, Loader2, Image as ImageIcon, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "model";
    parts: string;
    images?: { mimeType: string; data: string }[];
}

export default function NanobananaPage() {
    const [apiKey, setApiKey] = useState("");
    const [input, setInput] = useState("");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", parts: userMessage }]);
        setIsLoading(true);

        try {
            // Convert messages to Gemini format for history
            // Note: We only send text parts for history context to keep it simple for now,
            // as the model primarily uses text context to generate new images.
            // If the model supports image inputs in history for refinement, we would include them.
            const history = messages.map(m => ({
                role: m.role,
                parts: [{ text: m.parts }]
            }));

            const response = await fetch("/api/nanobanana", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    history,
                    apiKey,
                    aspectRatio,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to generate image");
            }

            // Check for images in the response
            const generatedImages = data.candidates?.[0]?.content?.parts
                ?.filter((part: any) => part.inlineData)
                ?.map((part: any) => part.inlineData) || [];

            const textResponse = data.candidates?.[0]?.content?.parts
                ?.filter((part: any) => part.text)
                ?.map((part: any) => part.text)
                ?.join("\n") || (generatedImages.length > 0 ? "Image generated successfully." : "No content returned.");

            setMessages((prev) => [
                ...prev,
                {
                    role: "model",
                    parts: textResponse,
                    images: generatedImages.length > 0 ? generatedImages : undefined
                }
            ]);

        } catch (error: any) {
            setMessages((prev) => [
                ...prev,
                { role: "model", parts: `Error: ${error.message}` },
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
                                        {msg.parts}
                                    </div>

                                    {/* Render Images if present */}
                                    {msg.images && msg.images.map((img, imgIndex) => (
                                        <div key={imgIndex} className="relative group mt-2">
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
                    <div className="p-4 bg-black/20 border-t border-white/5 flex flex-col gap-2">
                        <div className="flex gap-2 justify-center">
                            {["1:1", "16:9", "9:16", "4:3", "3:4"].map((ratio) => (
                                <Button
                                    key={ratio}
                                    type="button"
                                    variant={aspectRatio === ratio ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setAspectRatio(ratio)}
                                    className={cn(
                                        "text-xs h-7",
                                        aspectRatio === ratio ? "bg-accent text-white" : "text-muted-foreground hover:text-white"
                                    )}
                                >
                                    {ratio}
                                </Button>
                            ))}
                        </div>
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Describe the image you want to generate..."
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
