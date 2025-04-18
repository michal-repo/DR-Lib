"use client";

import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {useState} from "react";
import {useToast} from "@/hooks/use-toast";

const LoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const {toast} = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Basic validation
    if (!username || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    // Simulate successful login
    toast({
      title: "Success",
      description: `User ${username} logged in successfully!`,
    });
    setUsername("");
    setPassword("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-4 border rounded-md shadow-sm w-full md:w-96"
    >
      <h2 className="text-2xl font-semibold">Login</h2>
      <Input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit">Login</Button>
    </form>
  );
};

export default LoginForm;
