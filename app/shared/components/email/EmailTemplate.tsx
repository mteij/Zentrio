import { h as _h, ComponentChildren } from "preact";

interface EmailTemplateProps {
  title: string;
  header: string;
  body: ComponentChildren;
}

export function EmailTemplate({ header, body }: EmailTemplateProps) {
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
        <div style={{ backgroundColor: "#141414", padding: "20px", textAlign: "center" }}>
         <img src="https://github.com/michaeltukdev/Zentrio/blob/main/app/static/icons/icon-192.png?raw=true" alt="Zentrio Logo" style={{ width: "64px", height: "64px", margin: "0 auto" }} />
        </div>
        <div style={{ padding: "30px" }}>
          <h2 style={{ fontSize: "20px", margin: "0 0 20px 0" }}>
            {header}
          </h2>
          {body}
          <p style={{ fontSize: "14px", color: "#777" }}>
            If you did not request this email, you can safely ignore it.
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
          &copy; {new Date().getFullYear()} Zentrio. All rights reserved.
        </div>
      </div>
    </div>
  );
}