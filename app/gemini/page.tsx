"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Send, Key, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
    role: "user" | "model";
    parts: string;
}

export default function GeminiPage() {
    const [apiKey, setApiKey] = useState("");
    const [model, setModel] = useState("gemini-3-pro-preview");
    const [input, setInput] = useState("");
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
            const history = messages.map(m => ({
                role: m.role,
                parts: [{ text: m.parts }]
            }));

            const response = await fetch("/api/gemini", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    history,
                    apiKey, // Can be empty string, backend will handle it
                    model,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to fetch response");
            }

            setMessages((prev) => [...prev, { role: "model", parts: data.text }]);
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

                {/* Model Selector */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {["gemini-3-pro-preview", "gemini-3-pro-image-preview", "gemini-pro"].map((m) => (
                        <Button
                            key={m}
                            variant={model === m ? "primary" : "outline"}
                            size="sm"
                            onClick={() => setModel(m)}
                            className="whitespace-nowrap"
                        >
                            {m}
                        </Button>
                    ))}
                </div>

                {/* Chat Area */}
                <Card className="flex-1 flex flex-col overflow-hidden glass border-none shadow-2xl">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                <Bot className="h-16 w-16 mb-4" />
                                <p>Start a conversation with Gemini</p>
                            </div>
                        )}

                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "flex items-start gap-3 max-w-[80%]",
                                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                                )}
                            >
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                                        msg.role === "user" ? "bg-primary" : "bg-secondary"
                                    )}
                                >
                                    {msg.role === "user" ? (
                                        <User className="h-4 w-4 text-white" />
                                    ) : (
                                        <Bot className="h-4 w-4 text-primary" />
                                    )}
                                </div>
                                <div
                                    className={cn(
                                        "p-3 rounded-2xl text-sm",
                                        msg.role === "user"
                                            ? "bg-primary text-primary-foreground rounded-tr-none"
                                            : "bg-secondary text-secondary-foreground rounded-tl-none"
                                    )}
                                >
                                    {msg.parts}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-center gap-2 text-muted-foreground ml-11">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-xs">Gemini is thinking...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-black/20 border-t border-white/5">
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type your message..."
                                className="flex-1 bg-secondary/50 border-none focus-visible:ring-1 focus-visible:ring-primary/50"
                                disabled={isLoading}
                            />
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="bg-primary hover:bg-primary/90"
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
