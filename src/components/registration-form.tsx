"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast"; // Corrected path based on previous context
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Schema matches API requirements (username, email, password)
// Client-side validation can be stricter (e.g., password length)
const formSchema = z.object({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  password: z.string().min(8, { // Keep client-side validation stricter if desired
    message: "Password must be at least 8 characters.",
  }),
});

// Define props to accept an onSuccess callback
interface RegistrationFormProps {
  onSuccess?: () => void; // Optional callback for successful registration
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ onSuccess }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
        console.error("API URL is not defined. Please set NEXT_PUBLIC_API_URL environment variable.");
        toast({
            variant: "destructive",
            title: "Configuration Error",
            description: "The server is not configured correctly. Please contact support.",
        });
        setIsLoading(false);
        return;
    }

    try {
        const response = await fetch(`${apiUrl}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify({
                username: values.username,
                email: values.email,
                password: values.password,
            }),
        });

        let result;
        try {
            result = await response.json();
        } catch (jsonError) {
            console.error("Failed to parse JSON response:", jsonError);
            toast({
                variant: "destructive",
                title: "Server Error",
                description: `Received an invalid response from the server (Status: ${response.status}).`,
            });
            setIsLoading(false);
            return;
        }

        if (!response.ok) {
            // Handle API errors
            let errorMessage = "An unexpected error occurred during registration.";
            if (result && result.status && result.status.message) {
                errorMessage = result.status.message; // Use the specific message from API
            } else if (response.status === 409) {
                errorMessage = "Username or email already exists."; // User-friendly conflict message
            } else if (response.status === 400) {
                errorMessage = "Invalid registration details provided."; // User-friendly bad request message
            } else if (response.status === 503) {
                errorMessage = "Registration is currently unavailable."; // User-friendly unavailable message
            }

            // Log detailed error if available (debug mode)
            if (result?.error_details) {
                console.error("Registration Error Details:", result.error_details);
            }

            toast({
                variant: "destructive",
                title: "Registration Failed",
                description: errorMessage,
            });

        } else {
            // Handle success
            toast({
                title: "Registration Successful",
                description: (result?.data ? `${result.data} ` : "Account created successfully! ") + "You can now log in.", // Add guidance
            });
            form.reset(); // Clear the form fields
            onSuccess?.(); // Call the onSuccess callback (e.g., to close the dialog)
        }

    } catch (error) {
        console.error("Registration request failed:", error);
        toast({
            variant: "destructive",
            title: "Network Error",
            description: "Could not connect to the server. Please try again later.",
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      {/* Pass isLoading to disable form elements during submission */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Choose a username" {...field} disabled={isLoading} />
              </FormControl>
              {/* <FormDescription>
                This will be your public display name.
              </FormDescription> */}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" type="email" {...field} disabled={isLoading} />
              </FormControl>
              {/* <FormDescription>
                We'll use this for login and communication.
              </FormDescription> */}
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
                <Input type="password" placeholder="Create a password" {...field} disabled={isLoading} />
              </FormControl>
              <FormDescription>
                Must be at least 8 characters long.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Update button text and disable based on isLoading */}
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Registering..." : "Register"}
        </Button>
      </form>
    </Form>
  );
};

export default RegistrationForm;
