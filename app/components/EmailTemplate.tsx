import { h as _h } from "preact";

interface EmailTemplateProps {
  code: string;
  verificationUrl: string;
}

export function EmailTemplate({ code, verificationUrl }: EmailTemplateProps) {
  return (
    <div
      style={{
        fontFamily:
          '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        lineHeight: "1.5",
        color: "#333",
        backgroundColor: "#f4f4f4",
        padding: "20px",
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div style={{ backgroundColor: "#141414", padding: "20px" }}>
          <h1 style={{ color: "#ffffff", margin: "0", fontSize: "24px" }}>
            StremioHub
          </h1>
        </div>
        <div style={{ padding: "30px" }}>
          <h2 style={{ fontSize: "20px", margin: "0 0 20px 0" }}>
            Your sign-in code
          </h2>
          <p>
            Thanks for signing in to StremioHub. Please use the code below to
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
          <p style={{ fontSize: "14px", color: "#777" }}>
            If you did not request this code, you can safely ignore this email.
            This code will expire in 15 minutes.
          </p>
        </div>
        <div
          style={{
            backgroundColor: "#f0f0f0",
            padding: "20px",
            textAlign: "center",
            fontSize: "12px",
            color: "#777",
          }}
        >
          &copy; {new Date().getFullYear()} StremioHub. All rights reserved.
        </div>
      </div>
    </div>
  );
}
