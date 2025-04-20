// src/components/login-form.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { storeToken } from "@/lib/auth"; // <-- Import token utility

// Schema remains the same
const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(1, {
    message: "Password is required.",
  }),
});

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
        console.error("API URL is not defined.");
        toast({ variant: "destructive", title: "Configuration Error", description: "Cannot connect to server." });
        setIsLoading(false);
        return;
    }

    try {
      const response = await fetch(`${apiUrl}/log-in`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      });

      let result;
      try {
          result = await response.json();
      } catch (jsonError) {
          console.error("Failed to parse JSON response:", jsonError);
          toast({ variant: "destructive", title: "Server Error", description: `Invalid response (Status: ${response.status}).` });
          setIsLoading(false);
          return;
      }

      if (!response.ok) {
        let errorMessage = "An unexpected error occurred.";
        if (result?.status?.message) {
            errorMessage = result.status.message;
        } else if (response.status === 401) {
            errorMessage = "Invalid email or password.";
        } else if (response.status === 400) {
            errorMessage = "Invalid input provided.";
        } else if (response.status === 429) {
            errorMessage = "Too many login attempts. Please try again later.";
        }
        if (result?.error_details) console.error("Login Error Details:", result.error_details);
        toast({ variant: "destructive", title: "Login Failed", description: errorMessage });

      } else {
        // --- JWT Handling ---
        const token = result?.data?.token;
        if (token && typeof token === 'string') {
            storeToken(token); // <-- Store the received token
            toast({
              title: "Login Successful",
              description: "Welcome back!",
            });
            // Redirect to the main application page
            router.push('/main');
        } else {
            // Handle case where login succeeded (200 OK) but token was missing/invalid
            console.error("Login successful but token missing in response:", result);
            toast({ variant: "destructive", title: "Login Error", description: "Authentication failed: Invalid server response." });
        }
        // --- End JWT Handling ---
      }
    } catch (error) {
      console.error("Login request failed:", error);
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to the server." });
    } finally {
      setIsLoading(false);
    }
  }

  // JSX remains the same
  return (
    // Added width constraints for better layout within the page
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full max-w-sm">
        {/* Changed from username to email */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} type="email" disabled={isLoading} />
              </FormControl>
              {/* <FormDescription>Enter your email address.</FormDescription> */}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
              </FormControl>
              {/* <FormDescription>Enter your password.</FormDescription> */}
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Added w-full and loading state text */}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Log In"}
        </Button>
      </form>
    </Form>
  );
}
