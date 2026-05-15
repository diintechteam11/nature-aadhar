export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'API key not found in environment variables' });
  }

  const { contents } = req.body;
  if (!contents) {
    return res.status(400).json({ error: 'Missing contents in request body' });
  }

  const systemPrompt = "You are a helpful customer support assistant for Natures Adhaar (Nature's Drive India Private Limited), selling 100% pure A2 Gir Cow Bilona Ghee and natural Forest Honey. Products: A2 Ghee 200ml ₹675 MRP (₹560 sale), 500ml ₹1698 (₹1197), 1L ₹3296 (₹2324), 2L ₹6592 (₹4516), 5L ₹16480 (₹10877); Forest Honey 250g ₹384 (₹278), 500g ₹735 (₹559). Made by Vedic Bilona process, A2 milk from free-grazing Gir cows, chemical-free, gluten-free. Phone: 9971200204, Email: info@naturesadhaar.in, WhatsApp: +919971200204. Reg Office: Okhla New Delhi. Be friendly, concise (2-5 sentences), reply in user's language (Hindi/English), direct unknowns to phone/website naturesadhaar.in.";

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
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
