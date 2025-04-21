"use client";

import LoginForm from "@/components/login-form";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import RegistrationForm from "@/components/registration-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link"; // <-- Import Link

export default function Home() {
  const [open, setOpen] = useState(false);

  // Callback for successful registration to close the dialog
  const handleRegistrationSuccess = () => {
    setOpen(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Welcome to DR Lib</h1>
      <div className="space-y-4 w-full max-w-sm">
        <LoginForm />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              Register
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Register</DialogTitle>
              <DialogDescription>
                Create a new account to access all features.
              </DialogDescription>
            </DialogHeader>
            {/* Pass the success handler to the form */}
            <RegistrationForm onSuccess={handleRegistrationSuccess} />
          </DialogContent>
        </Dialog>

        {/* --- Added Button --- */}
        <Link href="/main" passHref legacyBehavior>
          <Button variant="secondary" className="w-full">
            Image Catalogs
          </Button>
        </Link>
        {/* --- End Added Button --- */}

      </div>
    </main>
  );
}
