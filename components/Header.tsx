import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-[var(--card-border)] bg-black/50 backdrop-blur-xl">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                        <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white">
                        Portal<span className="text-primary">.ai</span>
                    </span>
                </Link>

                <nav className="hidden md:flex items-center gap-6">
                    <Link href="/gemini" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        Gemini
                    </Link>
                    <Link href="/nanobanana" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        Nanobanana
                    </Link>
                </nav>

                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm">Sign In</Button>
                    <Button size="sm" className="bg-gradient-to-r from-primary to-accent border-0">Get Started</Button>
                </div>
            </div>
        </header>
    )
}
