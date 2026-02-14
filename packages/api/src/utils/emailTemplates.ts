type Cta = {
  label: string;
  url: string;
};

type MetaRow = {
  label: string;
  value: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeEmailText(value: string) {
  return escapeHtml(value);
}

function toText(lines: Array<string | undefined | null>) {
  return lines
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line) => line.trim())
    .join('\n');
}

export function renderLafloEmail(params: {
  preheader: string;
  title: string;
  greeting?: string;
  intro?: string;
  bodyHtml?: string;
  meta?: MetaRow[];
  cta?: Cta;
  footerNote?: string;
}) {
  const preheader = escapeHtml(params.preheader);
  const title = escapeHtml(params.title);
  const greeting = params.greeting ? escapeHtml(params.greeting) : '';
  const intro = params.intro ? escapeHtml(params.intro) : '';
  const logoUrl = 'https://laflo-web-production.up.railway.app/laflo-logo.png';

  const metaHtml =
    params.meta && params.meta.length
      ? `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 18px 0; border-collapse: collapse;">
          <tbody>
            ${params.meta
              .map((row) => {
                const label = escapeHtml(row.label);
                const value = escapeHtml(row.value);
                return `
                  <tr>
                    <td style="padding: 10px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 13px; color: #0f172a; width: 160px;">
                      <strong>${label}</strong>
                    </td>
                    <td style="padding: 10px 12px; border: 1px solid #e2e8f0; background: #ffffff; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 13px; color: #0f172a;">
                      ${value}
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      `
      : '';

  const ctaHtml = params.cta
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 18px 0 6px;">
        <tr>
          <td style="border-radius: 12px; background: #84cc16;">
            <a href="${escapeHtml(params.cta.url)}"
               style="display: inline-block; padding: 12px 18px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 14px; font-weight: 700; color: #0b1220; text-decoration: none; border-radius: 12px;">
              ${escapeHtml(params.cta.label)}
            </a>
          </td>
        </tr>
      </table>
    `
    : '';

  const footerNote = params.footerNote ? escapeHtml(params.footerNote) : '';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f1f5f9;">
    <!-- Preheader (hidden) -->
    <div style="display:none; font-size:1px; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden; mso-hide:all;">
      ${preheader}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f1f5f9; padding: 24px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width: 100%; max-width: 600px; border-collapse: separate; border-spacing: 0;">
            <tr>
              <td style="padding: 0 6px 12px;">
                <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-weight: 900; letter-spacing: -0.02em; font-size: 18px; color: #0f172a;"> 
                  <span style="display:inline-block; vertical-align:middle; margin-right: 10px; border-radius: 12px; background: #ffffff; border: 1px solid #e2e8f0; padding: 6px 8px;"> 
                    <img src="${logoUrl}" width="34" height="34" alt="LaFlo" style="display:block; width:34px; height:34px; object-fit:contain;" /> 
                  </span> 
                  <span style="vertical-align:middle;">Hotel Management</span> 
                </div> 
              </td>
            </tr>

            <tr>
              <td style="background: #ffffff; border-radius: 18px; padding: 22px 22px 18px; border: 1px solid #e2e8f0;">
                <h1 style="margin: 0 0 10px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 20px; line-height: 1.2; color: #0f172a;">
                  ${title}
                </h1>

                ${
                  greeting
                    ? `<p style="margin: 0 0 10px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #0f172a;">${greeting}</p>`
                    : ''
                }
                ${
                  intro
                    ? `<p style="margin: 0 0 10px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #334155;">${intro}</p>`
                    : ''
                }

                ${metaHtml}

                ${
                  params.bodyHtml
                    ? `<div style="margin: 10px 0 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 14px; line-height: 1.7; color: #0f172a;">
                        ${params.bodyHtml}
                      </div>`
                    : ''
                }

                ${ctaHtml}

                ${
                  footerNote
                    ? `<p style="margin: 14px 0 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #64748b;">
                        ${footerNote}
                      </p>`
                    : ''
                }
              </td>
            </tr>

            <tr>
              <td style="padding: 14px 6px 0;">
                <p style="margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #64748b;">
                  (c) ${new Date().getFullYear()} LaFlo. All rights reserved. 
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = toText([
    params.title,
    greeting ? greeting.replace(/<[^>]*>/g, '') : undefined,
    intro ? intro.replace(/<[^>]*>/g, '') : undefined,
    params.meta && params.meta.length
      ? params.meta.map((row) => `${row.label}: ${row.value}`).join('\n')
      : undefined,
    params.cta ? `${params.cta.label}: ${params.cta.url}` : undefined,
    params.footerNote,
  ]);

  return { html, text };
}

export function renderOtpEmail(params: { firstName: string; code: string }) {
  const code = escapeHtml(params.code);
  return renderLafloEmail({
    preheader: 'Your verification code (valid for 10 minutes).',
    title: 'Your verification code',
    greeting: `Hello ${params.firstName},`,
    intro: 'Use the code below to finish signing in. This code expires in 10 minutes.',
    bodyHtml: `
      <div style="margin: 14px 0 4px; padding: 14px 14px; border-radius: 16px; background: #0b1220;">
        <div style="font-size: 24px; letter-spacing: 10px; font-weight: 900; text-align: center; color: #d9f99d;">
          ${code}
        </div>
      </div>
      <p style="margin: 10px 0 0; color: #334155;">If you didn't request this code, you can ignore this email.</p> 
    `,
    footerNote: 'For your security, never share this code with anyone.',
  });
}
