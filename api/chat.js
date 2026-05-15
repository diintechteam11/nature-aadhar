export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
  const RESEND_KEY = 're_Nvjtx4NW_Eviqgxcga5265d4jckif8vWL'; // Hardcoded as requested, but recommended to use env var
  
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'API key not found in environment variables' });
  }

  const { contents } = req.body;
  if (!contents) {
    return res.status(400).json({ error: 'Missing contents in request body' });
  }

  const systemPrompt = "You are a helpful customer support assistant for Natures Adhaar (Nature's Drive India Private Limited), selling 100% pure A2 Gir Cow Bilona Ghee and natural Forest Honey. Products: A2 Ghee 200ml ₹675 MRP (₹560 sale), 500ml ₹1698 (₹1197), 1L ₹3296 (₹2324), 2L ₹6592 (₹4516), 5L ₹16480 (₹10877); Forest Honey 250g ₹384 (₹278), 500g ₹735 (₹559). Made by Vedic Bilona process, A2 milk from free-grazing Gir cows, chemical-free, gluten-free. Phone: 9971200204, Email: info@naturesadhaar.in, WhatsApp: +919971200204. Reg Office: Okhla New Delhi. \n\nLEAD COLLECTION: If a user wants to buy or order something, you MUST politely ask for their Name, Mobile Number, and Delivery Address one by one. Once you have all three pieces of information, confirm them to the user and say that the team will contact them shortly. Then, you MUST append this hidden tag at the very end of your response: [ORDER_LEAD: Name | Phone | Address]. Replace Name, Phone, and Address with the actual user details. \n\nBe friendly, concise (2-5 sentences), reply in user's language (Hindi/English), direct unknowns to phone/website naturesadhaar.in.";

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
    
    // Check for order lead tag in AI response
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      let aiText = data.candidates[0].content.parts[0].text;
      const leadMatch = aiText.match(/\[ORDER_LEAD: (.*?)\]/);
      
      if (leadMatch) {
        const leadDetails = leadMatch[1];
        // Send email via Resend API
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_KEY}`
            },
            body: JSON.stringify({
              from: 'Nature Adhaar Bot <onboarding@resend.dev>',
              to: 'diintechteam11@gmail.com',
              subject: 'New Order Request - ' + leadDetails.split('|')[0].trim(),
              html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                  <h2 style="color: #056737;">New Order Lead Received!</h2>
                  <p><strong>Customer Details:</strong> ${leadDetails}</p>
                  <hr/>
                  <p style="font-size: 12px; color: #666;">This lead was automatically captured by the AI Chatbot on Nature Adhaar website.</p>
                </div>
              `
            })
          });
        } catch (mailError) {
          console.error('Error sending email:', mailError);
        }
        
        // Remove the hidden tag from the user-facing text
        data.candidates[0].content.parts[0].text = aiText.replace(/\[ORDER_LEAD: (.*?)\]/, '').trim();
      }
    }

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}

