import { h } from "preact";

interface ResetPasswordEmailProps {
  resetUrl: string;
}

export function ResetPasswordEmail({ resetUrl }: ResetPasswordEmailProps) {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px", backgroundColor: "#f4f4f4" }}>
      <div style={{ maxWidth: "600px", margin: "auto", backgroundColor: "white", padding: "20px", borderRadius: "8px" }}>
        <h1 style={{ color: "#e50914" }}>Reset Your Zentrio Password</h1>
        <p>You requested a password reset. Click the button below to set a new password.</p>
        <a href={resetUrl} target="_blank" style={{ display: "inline-block", padding: "12px 24px", backgroundColor: "#e50914", color: "white", textDecoration: "none", borderRadius: "4px", fontWeight: "bold" }}>
          Reset Password
        </a>
        <p style={{ fontSize: "12px", color: "#777", marginTop: "20px" }}>
          This link is valid for 1 hour. If you did not request a password reset, please ignore this email.
        </p>
      </div>
    </div>
  );
}
