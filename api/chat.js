export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY; 
  
  if (!OPENAI_KEY || !RESEND_KEY) {
    return res.status(500).json({ error: 'API keys not found in environment variables (OPENAI_API_KEY, RESEND_API_KEY)' });
  }

  const { contents } = req.body;
  if (!contents) {
    return res.status(400).json({ error: 'Missing contents in request body' });
  }

  // Convert Gemini format to OpenAI format
  const messages = contents.map(m => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.parts[0].text
  }));

  // Count user messages to enforce the 2-chat rule
  const userMsgCount = messages.filter(m => m.role === 'user').length;

  const systemPrompt = `You are a helpful assistant for Natures Adhaar.

STRICT CONVERSATION FLOW:
1. For the first 2 user messages: Answer any questions normally and briefly.
2. IMMEDIATELY after the 2nd user message (when userMsgCount == 2), you MUST ignore everything else and say exactly: "I love your chat! What's your name and mobile number?"
3. VALIDATION:
   - If they give invalid details, say: "Yaar sahi to mobile number/name likho"
4. AFTER THEY PROVIDE VALID NAME & NUMBER:
   - Say: "thankU"
   - APPEND THIS TAG: [LEAD: Name | Phone]
   - Example: "thankU [LEAD: Rahul | 9876543210]"

Be extremely concise. Use Hinglish.`;

  messages.unshift({ role: 'system', content: systemPrompt });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: messages,
        temperature: 0.5
      })
    });

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      let aiText = data.choices[0].message.content;
      const leadMatch = aiText.match(/\[LEAD:\s*(.*?)\]/i);
      
      if (leadMatch) {
        const leadDetails = leadMatch[1];
        const chatLog = messages.filter(m => m.role !== 'system').map(m => `${m.role.toUpperCase()}: ${m.content}`).join('<br>');
        
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
              subject: 'Quick Lead: ' + leadDetails.split('|')[0].trim(),
              html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #056737; border-radius: 12px; max-width: 600px;">
                  <h2 style="color: #056737;">New Fast Lead!</h2>
                  <p><strong>Details:</strong> ${leadDetails}</p>
                  <hr/>
                  <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
                    ${chatLog}
                  </div>
                </div>
              `
            })
          });
        } catch (mailError) { console.error('Email failed:', mailError); }
        
        aiText = aiText.replace(/\[LEAD:.*?\]/i, '').trim();
      }
      
      return res.status(200).json({
          candidates: [{
              content: {
                  parts: [{ text: aiText }]
              }
          }]
      });
    }

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}

