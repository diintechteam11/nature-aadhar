export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY; 
  
  if (!GEMINI_KEY || !RESEND_KEY) {
    return res.status(500).json({ error: 'API keys not found in environment variables' });
  }

  const { contents } = req.body;
  if (!contents) {
    return res.status(400).json({ error: 'Missing contents in request body' });
  }

  const systemPrompt = "You are a helpful customer support assistant for Natures Adhaar (Nature's Drive India Private Limited), selling 100% pure A2 Gir Cow Bilona Ghee and natural Forest Honey. Products: A2 Ghee 200ml ₹675 MRP (₹560 sale), 500ml ₹1698 (₹1197), 1L ₹3296 (₹2324), 2L ₹6592 (₹4516), 5L ₹16480 (₹10877); Forest Honey 250g ₹384 (₹278), 500g ₹735 (₹559). Made by Vedic Bilona process, A2 milk from free-grazing Gir cows, chemical-free, gluten-free. Phone: 9971200204, Email: info@naturesadhaar.in, WhatsApp: +919971200204. Reg Office: Okhla New Delhi. \n\nLEAD COLLECTION FLOW:\n1. If a user wants to buy or order, you MUST ask for their Name, then Mobile Number, then Delivery Address (one by one).\n2. ONCE YOU HAVE ALL THREE (Name, Phone, Address), you must provide a summary to the user to confirm. \n3. IMPORTANT: In the SAME response where you provide the summary/confirmation, you MUST append this tag at the very end: [ORDER_LEAD: Name | Phone | Address]\n4. Do not wait for a second confirmation to send the tag. Send it as soon as you have the 3 details.\n\nBe friendly, concise, and reply in the user's language.";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: contents,
        generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      let aiText = data.candidates[0].content.parts[0].text;
      // Case-insensitive and flexible regex
      const leadMatch = aiText.match(/\[ORDER_LEAD:\s*(.*?)\]/i);
      
      if (leadMatch) {
        const leadDetails = leadMatch[1];
        const chatLog = contents.map(m => `${m.role.toUpperCase()}: ${m.parts[0].text}`).join('<br>');
        
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_KEY}`
            },
            body: JSON.stringify({
              from: 'Nature Adhaar Bot <onboarding@resend.dev>',
              to: 'vectrizeaiteam@gmail.com',
              subject: 'New Lead: ' + leadDetails.split('|')[0].trim(),
              html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #056737; border-radius: 12px; max-width: 600px;">
                  <h2 style="color: #056737; margin-top: 0;">New Order Lead Captured!</h2>
                  <p style="font-size: 16px;"><strong>Details:</strong> <span style="color: #d35400;">${leadDetails}</span></p>
                  <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"/>
                  <h3 style="color: #555;">Full Conversation Context:</h3>
                  <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; font-size: 13px; line-height: 1.5;">
                    ${chatLog}
                    <br><strong>AI (Final):</strong> ${aiText.replace(/\[ORDER_LEAD:.*?\]/i, '')}
                  </div>
                  <p style="margin-top: 20px; font-size: 11px; color: #999;">Source: Nature Adhaar Website Chatbot</p>
                </div>
              `
            })
          });
        } catch (mailError) {
          console.error('Email failed:', mailError);
        }
        
        // Clean output for user
        data.candidates[0].content.parts[0].text = aiText.replace(/\[ORDER_LEAD:.*?\]/i, '').trim();
      }
    }

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}

