// ...existing code from app/islands/CodeInputForm.tsx...
import { h } from "preact";
import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { useToast } from "../../shared/hooks/useToast.ts";

interface CodeInputFormProps {
  email: string;
}

export default function CodeInputForm({ email }: CodeInputFormProps) {
  const code = useSignal(new Array(6).fill(""));
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);
  const isResending = useSignal(false);
  const resendCooldown = useSignal(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { success, error: showError } = useToast();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown.value > 0) {
      const timer = setTimeout(() => {
        resendCooldown.value = resendCooldown.value - 1;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown.value]);

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

  const handleResend = async () => {
    if (resendCooldown.value > 0 || isResending.value) return;

    isResending.value = true;
    error.value = null;

    try {
      const res = await fetch("/api/auth/send-login-code", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
 
      if (res.ok) {
        resendCooldown.value = 30; // Start 30-second cooldown
        // Clear the current code
        code.value = new Array(6).fill("");
        inputRefs.current[0]?.focus();
        success("A new code has been sent to your email.");
      } else {
        const data = await res.json();
        error.value = data.error || "Failed to resend code. Please try again.";
      }
    } catch (_err) {
      error.value = "Network error. Please try again.";
    } finally {
      isResending.value = false;
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
      success("Login successful!");
      setTimeout(() => {
        globalThis.location.href = "/profiles";
      }, 1000);
    } else {
      const data = await res.json();
      showError(data.error || "Verification failed.");
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
      <div class="mt-4 text-center">
        <p class="text-xs sm:text-sm text-gray-400 mb-3 transition-all duration-200">
          Can't find your code? Check your spam folder.
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown.value > 0 || isResending.value}
          class="text-sm text-red-500 hover:text-red-400 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isResending.value 
            ? "Sending..." 
            : resendCooldown.value > 0 
              ? `Resend code in ${resendCooldown.value}s` 
              : "Resend code"
          }
        </button>
      </div>
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
