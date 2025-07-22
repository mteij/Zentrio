import { h } from "preact";
import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

interface CodeInputFormProps {
  email: string;
}

export default function CodeInputForm({ email }: CodeInputFormProps) {
  const code = useSignal(new Array(6).fill(""));
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleInput = (e: h.JSX.TargetedEvent<HTMLInputElement>, index: number) => {
    const input = e.currentTarget;
    let value = input.value;
    if (!/^\d*$/.test(value)) { // only allow digits
      input.value = code.value[index];
      return;
    }
    
    value = value.slice(-1); // Max 1 char
    input.value = value;

    const newCode = [...code.value];
    newCode[index] = value;
    code.value = newCode;

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !code.value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    isLoading.value = true;
    error.value = null;
    const fullCode = code.value.join("");

    if (fullCode.length !== 6) {
      error.value = "Please enter the full 6-digit code.";
      isLoading.value = false;
      return;
    }

    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code: fullCode }),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      // The cookie is now set by the server. We just need to redirect.
      globalThis.location.href = "/profiles";
    } else {
      const data = await res.json();
      error.value = data.error || "Verification failed.";
      isLoading.value = false;
      code.value = new Array(6).fill("");
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <form onSubmit={handleSubmit} class="animate-fadein">
      <div class="flex justify-center gap-2 mb-6">
        {code.value.map((digit, index) => (
          <input
            key={index}
            ref={(el) => inputRefs.current[index] = el}
            type="tel"
            maxLength={1}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            value={digit}
            onInput={(e) => handleInput(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            disabled={isLoading.value}
            class="w-10 h-12 sm:w-12 sm:h-14 text-center text-2xl font-bold bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200 focus:scale-110"
            style="font-variant-numeric: tabular-nums;"
          />
        ))}
      </div>
      {error.value && <div class="text-red-500 bg-red-100 p-3 rounded mb-4 transition-all duration-200">{error.value}</div>}
      <button
        type="submit"
        disabled={isLoading.value || code.value.join("").length !== 6}
        class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200"
      >
        {isLoading.value ? "Verifying..." : "Verify"}
      </button>
      <p class="text-xs sm:text-sm text-gray-400 mt-4 transition-all duration-200">
        Can't find your code? Check your spam folder.
      </p>
      <style>
        {`
          @keyframes fadein {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fadein {
            animation: fadein 0.5s cubic-bezier(.4,2,.6,1);
          }
        `}
      </style>
    </form>
  );
}
