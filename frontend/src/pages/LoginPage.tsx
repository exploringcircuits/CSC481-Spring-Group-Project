import { useState } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
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
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/useAuth"
import { ApiError } from "@/services/api"

const DEMO_ADMIN_EMAIL = "admin@demo.local"
const DEMO_ADMIN_PASSWORD = "demoadmin"

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fromPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname

  async function signIn(emailToUse: string, passwordToUse: string) {
    setSubmitting(true)
    try {
      await login({ email: emailToUse, password: passwordToUse })
      toast.success("Signed in.")
      navigate(fromPath || "/leagues", { replace: true })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Sign-in failed."
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      toast.error("Email and password are required.")
      return
    }
    await signIn(email, password)
  }

  function fillDemoAdmin() {
    setEmail(DEMO_ADMIN_EMAIL)
    setPassword(DEMO_ADMIN_PASSWORD)
  }

  async function signInAsDemoAdmin() {
    setEmail(DEMO_ADMIN_EMAIL)
    setPassword(DEMO_ADMIN_PASSWORD)
    await signIn(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to manage your fantasy leagues.</CardDescription>
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>

          <div className="flex items-center w-full gap-3">
            <Separator className="flex-1" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              demo
            </span>
            <Separator className="flex-1" />
          </div>

          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={fillDemoAdmin}
              disabled={submitting}
            >
              Fill admin credentials
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={signInAsDemoAdmin}
              disabled={submitting}
            >
              Sign in as admin
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Uses <code className="font-mono">{DEMO_ADMIN_EMAIL}</code>. Make sure
            <code className="ml-1 font-mono">manage.py seed_admin_user</code> has run.
          </p>

          <p className="text-sm text-muted-foreground text-center">
            New here?{" "}
            <Link to="/signup" className="text-foreground font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
