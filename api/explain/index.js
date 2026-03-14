const https = require('https');

function callFoundry(prompt) {
  return new Promise((resolve, reject) => {
    const endpoint = process.env.FoundryEndpoint; // e.g. https://xxx.services.ai.azure.com/api/projects/yyy
    const apiKey = process.env.FoundryKey;
    const assistant = 'clearmatch-explain'; // Assume assistant name

    if (!endpoint || !apiKey) {
      return reject(new Error('Foundry endpoint or key not configured.'));
    }

    const url = `${endpoint}/assistants/${assistant}/run`;

    const body = JSON.stringify({
      input: {
        query: prompt,
      },
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(url, options, (res) => {
      let chunks = '';
      res.on('data', (d) => (chunks += d));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let detail = chunks;
          try {
            detail = JSON.parse(chunks);
          } catch (e) {
            // ignore
          }
          return reject(new Error(`Foundry API returned ${res.statusCode}: ${JSON.stringify(detail)}`));
        }

        try {
          const json = JSON.parse(chunks);
          const text = json.output || json.response || 'No explanation generated.';
          resolve(text);
        } catch (e) {
          reject(new Error(`Invalid Foundry response: ${e.message} (${chunks})`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function (context, req) {
  try {
    const body = req.body || {};
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

    const explanation = await callFoundry(prompt);

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { explanation },
    };
  } catch (err) {
    context.log.error(err);
    context.res = {
      status: 500,
      body: { error: err.message },
    };
  }
};
