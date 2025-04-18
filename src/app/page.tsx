import LoginForm from "@/components/login-form";
import RegistrationForm from "@/components/registration-form";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Welcome to AccessKey</h1>
      <div className="flex flex-col md:flex-row gap-4">
        <LoginForm />
        <RegistrationForm />
      </div>
    </main>
  );
}

