import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { htmlContent, options = {} } = await req.json();

    const docRaptorApiKey = Deno.env.get('DOCRAPTOR_API_KEY');
    if (!docRaptorApiKey) {
      console.error('DocRaptor API key not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'DocRaptor API key not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Generating PDF document via DocRaptor');

    // DocRaptor API endpoint
    const url = 'https://docraptor.com/docs';
    
    const requestBody = {
      user_credentials: docRaptorApiKey,
      doc: {
        document_content: htmlContent,
        document_type: 'pdf',
        test: options.test || false,
        prince_options: {
          media: 'print',
          baseurl: options.baseUrl || 'https://aiwholesail.com',
          ...options.princeOptions
        },
        ...options
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DocRaptor API failed: ${response.status} ${errorText}`);
    }

    // DocRaptor returns the PDF as binary data
    const pdfBuffer = await response.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    console.log('PDF generated successfully via DocRaptor');

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfBase64: pdfBase64,
        size: pdfBuffer.byteLength,
        cost: options.test ? 0 : 0.01, // DocRaptor cost per PDF
        features: [
          'PrinceXML HTML-to-PDF engine',
          'Headers, page breaks, page numbers',
          'Flexbox support',
          'Watermarks and accessible PDFs',
          '99.99% uptime guarantee',
          'SOC2 and HIPAA compliant'
        ],
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-pdf-document function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to generate PDF document'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});