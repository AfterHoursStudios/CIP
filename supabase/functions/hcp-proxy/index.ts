import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const HCP_API_BASE = 'https://api.housecallpro.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hcp-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing endpoint parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get HCP API key from header
    const hcpApiKey = req.headers.get('x-hcp-api-key');

    if (!hcpApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing HCP API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the HCP API URL
    const hcpUrl = `${HCP_API_BASE}${endpoint}`;

    // Check if this is a file upload (multipart/form-data)
    const contentType = req.headers.get('content-type') || '';
    const isFileUpload = contentType.includes('multipart/form-data');

    // Build headers for HCP request
    const hcpHeaders: Record<string, string> = {
      'Authorization': `Bearer ${hcpApiKey}`,
    };

    // Only set Content-Type for non-file uploads
    // For file uploads, we need to pass through the original content-type with boundary
    if (!isFileUpload) {
      hcpHeaders['Content-Type'] = 'application/json';
    } else {
      // Pass through the multipart content-type header with boundary
      hcpHeaders['Content-Type'] = contentType;
    }

    // Forward the request to HCP
    const hcpRequestInit: RequestInit = {
      method: req.method,
      headers: hcpHeaders,
    };

    // Forward body for POST/PATCH requests
    if (req.method === 'POST' || req.method === 'PATCH') {
      if (isFileUpload) {
        // For file uploads, pass the raw body
        hcpRequestInit.body = await req.arrayBuffer();
      } else {
        const body = await req.text();
        if (body) {
          hcpRequestInit.body = body;
        }
      }
    }

    console.log('HCP Request:', hcpUrl, hcpRequestInit.method, isFileUpload ? '(file upload)' : '');
    const hcpResponse = await fetch(hcpUrl, hcpRequestInit);
    const responseData = await hcpResponse.text();
    console.log('HCP Response:', hcpResponse.status, responseData);

    // If HCP returns an error, include more details
    if (!hcpResponse.ok) {
      return new Response(
        JSON.stringify({
          error: `HCP API Error: ${hcpResponse.status}`,
          details: responseData,
          url: hcpUrl
        }),
        {
          status: hcpResponse.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(responseData, {
      status: hcpResponse.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('HCP Proxy Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
