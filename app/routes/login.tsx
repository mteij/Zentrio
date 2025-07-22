import { h as _h } from "preact";
import EmailLinkForm from "../islands/EmailLinkForm.tsx";

export default function LoginPage() {
  return (
    <div class="flex-grow flex flex-col items-center justify-center p-4">
      <div class="w-full max-w-md bg-black bg-opacity-75 p-8 rounded-lg">
        <h1 class="text-3xl font-bold mb-6 text-center">Sign In to StremioHub</h1>
        <p class="text-center text-gray-400 mb-4">
          Enter your email below to receive a magic link to sign in.
        </p>
        <EmailLinkForm />
      </div>
    </div>
  );
}
