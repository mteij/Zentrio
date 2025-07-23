import { h as _h } from "preact";
import { EmailTemplate } from "./EmailTemplate.tsx";

interface LoginCodeEmailProps {
  code: string;
  verificationUrl: string;
}

export function LoginCodeEmail({ code, verificationUrl }: LoginCodeEmailProps) {
  return (
    <EmailTemplate
      title="Your Sign-In Code"
      header="Your sign-in code"
      body={
        <>
          <p>
            Thanks for signing in to Zentrio. Please use the code below to
            complete your sign-in process.
          </p>
          <div
            style={{
              fontSize: "36px",
              fontWeight: "bold",
              letterSpacing: "8px",
              textAlign: "center",
              margin: "30px 0",
              padding: "15px",
              backgroundColor: "#f0f0f0",
              borderRadius: "4px",
            }}
          >
            {code}
          </div>
          <p>
            Alternatively, you can sign in instantly by clicking the button
            below:
          </p>
          <a
            href={verificationUrl}
            target="_blank"
            style={{
              display: "inline-block",
              backgroundColor: "#e50914",
              color: "#ffffff",
              padding: "12px 24px",
              textDecoration: "none",
              borderRadius: "4px",
              fontWeight: "bold",
              margin: "10px 0",
            }}
          >
            Sign In Automatically
          </a>
          <p>This code and link will expire in 15 minutes.</p>
        </>
      }
    />
  );
}
