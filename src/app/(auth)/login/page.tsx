"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { fadeInUp } from "../../../lib/motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LoaderCircle, Lock, Mail } from "lucide-react";
import LoaderOverlay from "@/components/loader/LoaderOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = {
  email: string;
  password: string;
};

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Invalid email or password");
        setLoading(false);
        return;
      }
      toast.success("Signed in successfully!");
      router.push("/dashboard");
    } catch (err) {
      toast.error("Login failed. Please check your network connection.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <div
          className="hidden md:flex flex-col items-start justify-center p-8 rounded-xl text-white shadow-lg"
          style={{ background: "linear-gradient(135deg, rgba(15,118,110,1), rgba(45,212,191,0.9))" }}
        >
          <h1 className="text-3xl font-semibold font-heading">Expense Manager</h1>
          <p className="mt-3 text-sm opacity-90">A calm, premium personal finance manager — simple, secure, and private.</p>
        </div>

        <motion.div className="card p-8 flex flex-col justify-center" variants={fadeInUp} initial="hidden" animate="show">
          <h2 className="text-xl font-semibold font-heading">Sign in</h2>
          <p className="text-xs text-muted-foreground mt-1">Enter your credentials to access your financial workspace.</p>
          
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-2">
              <Label htmlFor="login-email" className="flex items-center gap-1.5 text-xs">
                <Mail className="size-3.5 text-muted-foreground" /> Email
              </Label>
              <Input
                id="login-email"
                type="email"
                placeholder="name@example.com"
                {...register("email")}
                disabled={loading}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="login-password" className="flex items-center gap-1.5 text-xs">
                <Lock className="size-3.5 text-muted-foreground" /> Password
              </Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
                disabled={loading}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-6 w-full flex items-center justify-center gap-2"
            >
              {loading && <LoaderCircle className="size-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </motion.div>
      </div>

      <LoaderOverlay show={loading} label="Signing in & loading workspace..." />
    </div>
  );
}

