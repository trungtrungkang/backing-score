import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

export const resend = apiKey ? new Resend(apiKey) : null;

// The default sender email domain (needs to be verified in Resend Dashboard)
export const SENDER_EMAIL = "no-reply@backingscore.com";

interface SendEmailParams {
  to: string;
  subject: string;
  react?: React.ReactElement;
  html?: string;
  replyTo?: string;
}

import { render } from "@react-email/components";

/**
 * Helper to gracefully send email using Resend and React Email.
 */
export async function sendEmail({ to, subject, react, html, replyTo }: SendEmailParams) {
  if (!resend) {
    console.warn("RESEND_API_KEY is not defined. Email dispatch ignored.", { to, subject });
    return { success: false, error: "Missing RESEND_API_KEY" };
  }

  try {
    const finalHtml = html || (react ? await render(react) : "");
    const { data, error } = await resend.emails.send({
      from: `Backing & Score <${SENDER_EMAIL}>`,
      to,
      subject,
      html: finalHtml,
      replyTo,
    });

    if (error) {
      console.error("[Resend Error]:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[Email Sending Exception]:", error);
    return { success: false, error };
  }
}
