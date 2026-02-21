import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const GMAIL_USER = Deno.env.get('GMAIL_USER');
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD');
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:8081';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      throw new Error('Gmail credentials not configured');
    }

    const { email, companyName, inviterName, role } = await req.json();

    console.log('Sending email to:', email);

    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
      },
    });

    // Link directly to the login page
    const loginUrl = `${APP_URL}/(auth)/login`;

    await client.send({
      from: { name: "Construction Inspection Pro", mail: GMAIL_USER! },
      to: email,
      subject: `You're invited to join ${companyName} on Construction Inspection Pro`,
      content: 'auto',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background: linear-gradient(135deg, #1E3A5F 0%, #2E5077 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Construction Inspection Pro</h1>
          </div>

          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1E3A5F; margin-top: 0;">You're Invited!</h2>

            <p>Hi there,</p>

            <p><strong>${inviterName || 'A team member'}</strong> has invited you to join <strong>${companyName}</strong> on Construction Inspection Pro as an <strong style="text-transform: capitalize;">${role}</strong>.</p>

            <p>Construction Inspection Pro helps construction teams manage inspections, track issues, and generate professional reports.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: #1E3A5F; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Accept Invitation & Sign In</a>
            </div>

            <p style="color: #666; font-size: 14px;">Sign up or log in with <strong>${email}</strong> and you'll automatically be added to the team.</p>

            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

            <p style="color: #999; font-size: 12px; margin-bottom: 0;">
              This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
