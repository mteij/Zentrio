import { h as _h } from "preact";

interface WelcomeEmailProps {
  email: string;
  password: string;
  loginUrl: string;
}

export function WelcomeEmail({ email, password, loginUrl }: WelcomeEmailProps) {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px", backgroundColor: "#f4f4f4" }}>
      <div style={{ maxWidth: "600px", margin: "auto", backgroundColor: "white", padding: "20px", borderRadius: "8px" }}>
        <h1 style={{ color: "#e50914" }}>Welcome to Zentrio!</h1>
        <p>Your account has been created. You can now log in using your email and the password below.</p>
        <p><strong>Email:</strong> {email}</p>
        <p><strong>Password:</strong> <code style={{ background: "#eee", padding: "4px 8px", borderRadius: "4px" }}>{password}</code></p>
        <p>We recommend changing this password after your first login.</p>
        <a href={loginUrl} target="_blank" style={{ display: "inline-block", padding: "12px 24px", backgroundColor: "#e50914", color: "white", textDecoration: "none", borderRadius: "4px", fontWeight: "bold" }}>
          Log In Now
        </a>
        <p style={{ fontSize: "12px", color: "#777", marginTop: "20px" }}>
          If you did not sign up for Zentrio, you can safely ignore this email.
        </p>
      </div>
    </div>
  );
}
