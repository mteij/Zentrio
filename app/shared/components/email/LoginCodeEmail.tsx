import { h as _h } from "preact";

interface LoginCodeEmailProps {
  code: string;
  verificationUrl: string;
}

export function LoginCodeEmail({ code, verificationUrl }: LoginCodeEmailProps) {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px", backgroundColor: "#f4f4f4" }}>
      <div style={{ maxWidth: "600px", margin: "auto", backgroundColor: "white", padding: "20px", borderRadius: "8px" }}>
        <h1 style={{ color: "#e50914" }}>Your Zentrio Sign-In Code</h1>
        <p>Thanks for signing in to Zentrio. Please use the code below to complete your sign-in process.</p>
        
        <div style={{
          fontSize: "36px",
          fontWeight: "bold",
          letterSpacing: "8px",
          textAlign: "center",
          margin: "30px 0",
          padding: "20px",
          backgroundColor: "#f8f9fa",
          border: "2px solid #e50914",
          borderRadius: "8px",
          color: "#e50914"
        }}>
          {code}
        </div>
        
        <p>Alternatively, you can sign in instantly by clicking the button below:</p>
        
        <a href={verificationUrl} target="_blank" style={{
          display: "inline-block",
          padding: "12px 24px",
          backgroundColor: "#e50914",
          color: "white",
          textDecoration: "none",
          borderRadius: "4px",
          fontWeight: "bold",
          margin: "10px 0"
        }}>
          Sign In Automatically
        </a>
        
        <p style={{ fontSize: "14px", color: "#666", marginTop: "20px" }}>
          This code and link will expire in 15 minutes.
        </p>
        
        <p style={{ fontSize: "12px", color: "#777", marginTop: "20px" }}>
          If you did not request this code, you can safely ignore this email.
        </p>
      </div>
    </div>
  );
}
