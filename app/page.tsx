import { Header } from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Bot, Zap } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background -z-10" />

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
            Access AI Power <br />
            <span className="text-gradient">Pay Per Call</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mb-10">
            Stop paying monthly subscriptions. Access Google Gemini and Nanobanana Pro tools with a simple pay-as-you-go model.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/gemini">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                Launch Gemini <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/nanobanana">
              <Button variant="outline" size="lg" className="w-full sm:w-auto gap-2">
                Open Nanobanana <Zap className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="glass hover:border-primary/50 transition-colors group cursor-pointer">
              <CardHeader>
                <Bot className="h-10 w-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <CardTitle>Google Gemini</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Access the latest Gemini models for chat, code generation, and analysis.
                  Pay only for the tokens you use.
                </p>
              </CardContent>
            </Card>

            <Card className="glass hover:border-accent/50 transition-colors group cursor-pointer">
              <CardHeader>
                <Zap className="h-10 w-10 text-accent mb-4 group-hover:scale-110 transition-transform" />
                <CardTitle>Nanobanana Pro</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Exclusive access to Nanobanana Pro tools.
                  (Integration pending API details).
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  )
}
