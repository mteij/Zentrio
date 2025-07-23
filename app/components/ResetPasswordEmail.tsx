import { h as _h } from "preact";
import { EmailTemplate } from "./EmailTemplate.tsx";
import { EmailButton } from "../shared/components/email/EmailButton.tsx";

interface ResetPasswordEmailProps {
  resetUrl: string;
}

export function ResetPasswordEmail({ resetUrl }: ResetPasswordEmailProps) {
  return (
    <EmailTemplate
      title="Reset Password - StremioHub"
      header="Reset Your Password"
      body={
        <div>
          <p>You requested a password reset. Click the button below to set a new password.</p>
          <div style={{ textAlign: "center", margin: "30px 0" }}>
            <EmailButton href={resetUrl}>Reset Password</EmailButton>
          </div>
          <p style={{ fontSize: "12px", color: "#777", marginTop: "20px" }}>
            This link is valid for 1 hour. If you did not request a password reset, please ignore this email.
          </p>
        </div>
      }
    />
  );
}
