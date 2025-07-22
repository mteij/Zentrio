import { PageProps } from "$fresh/server.ts";
import CodeInputForm from "../../islands/CodeInputForm.tsx";
import ModernBackground from "../../components/ModernBackground.tsx";

export default function CodeVerificationPage(props: PageProps) {
  const emailParam = props.url.searchParams.get("email");
  const email = emailParam ? decodeURIComponent(emailParam) : null;

  if (!email) {
    return new Response("Email parameter is missing.", { status: 400 });
  }

  return (
    <>
      <ModernBackground />
      <div class="flex-grow flex items-center justify-center p-4 relative z-10">
        <div class="w-full max-w-md min-w-[320px] bg-black bg-opacity-75 p-6 sm:p-8 rounded-lg text-center shadow-lg">
          <h1 class="text-2xl sm:text-3xl font-bold mb-4">Check your email</h1>
          <p class="text-gray-400 mb-6 text-sm sm:text-base">
            We've sent a 6-digit code to{" "}
            <strong class="text-white break-all">{email}</strong>. The code expires
            shortly, so please enter it soon.
          </p>
          <CodeInputForm email={email} />
        </div>
      </div>
    </>
  );
}
