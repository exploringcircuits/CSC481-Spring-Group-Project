import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { ApiError } from "@/services/api"

export function SignUpPage() {
  const navigate = useNavigate()
  const { register, login } = useAuth()

  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }
    setSubmitting(true)
    try {
      await register({ email, password, display_name: displayName })
      // Auto-log-in after a successful registration so the demo flow is one click.
      await login({ email, password })
      toast.success("Account created. Welcome!")
      navigate("/leagues", { replace: true })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Sign-up failed."
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero-dark px-4 py-12">
      <Card className="w-full max-w-md border-border/60 bg-card/90 backdrop-blur-sm shadow-2xl shadow-black/40">
        <CardHeader className="text-center pb-4">
          <Link to="/" className="inline-block">
            <img src="/fantasy-fanatics-logo.svg" alt="Fantasy Fanatics" className="h-10 w-auto mx-auto mb-3" />
          </Link>
          <CardTitle className="text-display text-3xl tracking-wide">JOIN UP</CardTitle>
          <CardDescription>Start managing fantasy basketball leagues.</CardDescription>
        </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="display_name">Display name</Label>
            <Input
              id="display_name"
              type="text"
              autoComplete="name"
              placeholder="What teammates will see"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating…" : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-foreground font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
      </Card>
    </div>
  )
}
