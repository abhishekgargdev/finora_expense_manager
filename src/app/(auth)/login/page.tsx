"use client";
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../../lib/motion';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type FormValues = {
  email: string;
  password: string;
};

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });

export default function LoginPage() {
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { isSubmitting } = formState;

  async function onSubmit(data: FormValues) {
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Invalid email or password');
        return;
      }
      router.push('/dashboard');
    } catch (err) {
      toast.error('Login failed');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <div className="hidden md:flex flex-col items-start justify-center p-8 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, rgba(15,118,110,1), rgba(45,212,191,0.9))' }}>
          <h1 className="text-3xl font-semibold">Expense Manager</h1>
          <p className="mt-3 text-sm opacity-90">A calm, premium personal finance manager — simple and private.</p>
        </div>

        <motion.div className="card p-8" variants={fadeInUp} initial="hidden" animate="show">
          <h2 className="text-lg font-semibold">Sign in</h2>
          <form className="mt-4" onSubmit={handleSubmit(onSubmit)}>
            <label className="block text-sm text-muted-foreground">Email</label>
            <input {...register('email')} className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-transparent" />

            <label className="block text-sm text-muted-foreground mt-4">Password</label>
            <input {...register('password')} type="password" className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-transparent" />

            <button type="submit" className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md">
              {isSubmitting ? <span className="loader mr-2" /> : null}
              Sign in
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
