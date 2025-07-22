import { PageProps } from "$fresh/server.ts";
import CodeInputForm from "../../islands/CodeInputForm.tsx";

export default function CodeVerificationPage(props: PageProps) {
  const email = props.url.searchParams.get("email");

  if (!email) {
    return new Response("Email parameter is missing.", { status: 400 });
  }

  return (
    <div class="flex-grow flex flex-col items-center justify-center p-4">
      <div class="w-full max-w-md bg-black bg-opacity-75 p-8 rounded-lg text-center">
        <h1 class="text-3xl font-bold mb-4">Check your email</h1>
        <p class="text-gray-400 mb-6">
          We've sent a 6-digit code to <strong class="text-white">{email}</strong>. The code expires shortly, so please enter it soon.
        </p>
        <CodeInputForm email={email} />
      </div>
    </div>
  );
}
