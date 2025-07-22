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

    if (newCode.every(c => c)) {
      handleSubmit();
    }
  };

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key === "Backspace" && !code.value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    isLoading.value = true;
    error.value = null;
    const fullCode = code.value.join("");

    const res = await fetch("/api/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code: fullCode }),
      headers: { "Content-Type": "application/json" },
    });

    if (res.ok) {
      window.location.href = "/profiles";
    } else {
      const text = await res.text();
      error.value = text || "Verification failed.";
      isLoading.value = false;
      code.value = new Array(6).fill("");
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div>
      <div class="flex justify-center gap-2 mb-6">
        {code.value.map((digit, index) => (
          <input
            key={index}
            ref={(el) => inputRefs.current[index] = el}
            type="tel"
            maxLength={1}
            value={digit}
            onInput={(e) => handleInput(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            disabled={isLoading.value}
            class="w-12 h-14 text-center text-2xl font-bold bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-red-600"
          />
        ))}
      </div>
      {error.value && <div class="text-red-500 bg-red-100 p-3 rounded mb-4">{error.value}</div>}
      <p class="text-sm text-gray-400">
        Can't find your code? Check your spam folder.
      </p>
    </div>
  );
}
