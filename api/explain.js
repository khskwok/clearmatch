const { app } = require('@azure/functions');
const https = require('https');

function callAzureOpenAI(prompt) {
  return new Promise((resolve, reject) => {
    const endpoint = process.env.OpenAIEndpoint;      // e.g. https://xxx.openai.azure.com/
    const deployment = process.env.OpenAIDeployment;  // e.g. gpt-4o-mini
    const apiKey = process.env.OpenAIKey;

    if (!endpoint || !deployment || !apiKey) {
      return reject(new Error('OpenAI endpoint, key, or deployment not configured.'));
    }

    const url = new URL(
      `/openai/deployments/${deployment}/chat/completions?api-version=2024-08-01-preview`,
      endpoint
    );

    const body = JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            'You are an MPF operations analyst. Explain reconciliation issues clearly and briefly for business users. Do not change any numbers.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 250
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(url, options, (res) => {
      let chunks = '';
      res.on('data', (d) => (chunks += d));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let detail = chunks;
          try { detail = JSON.parse(chunks); } catch (e) {}
          return reject(new Error(`OpenAI API returned ${res.statusCode}: ${JSON.stringify(detail)}`));
        }
        try {
          const json = JSON.parse(chunks);
          const text = json.choices?.[0]?.message?.content || 'No explanation generated.';
          resolve(text);
        } catch (e) {
          reject(new Error(`Invalid OpenAI response: ${e.message} (${chunks})`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

app.http('explain', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'explain',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const ex = body.exception || {};

      const prompt = `
You are reconciling MPF contributions for an employee.

Data:
- Employee ID: ${ex.empId || 'N/A'}
- Employee name: ${ex.empName || 'N/A'}
- Period: ${ex.period || 'N/A'}
- Expected employer (ER) contribution: ${ex.expectedER}
- Expected employee (EE) contribution: ${ex.expectedEE}
- Received employer (ER) contribution: ${ex.receivedER}
- Received employee (EE) contribution: ${ex.receivedEE}
- Issue type: ${ex.issueType}
- Reason code: ${ex.reasonCode}

Explain in 2–4 sentences:
1) What is wrong for this employee and period.
2) Likely MPF operations cause (e.g. missing line in trustee file, wrong salary, late payment).
3) A specific next action (e.g. contact employer to collect underpayment HKD X).
Keep all numbers exactly as provided.
`;

      const explanation = await callAzureOpenAI(prompt);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explanation })
      };
    } catch (err) {
      context.log.error(err);
      return {
        status: 500,
        body: JSON.stringify({ error: err.message })
      };
    }
  }
});
