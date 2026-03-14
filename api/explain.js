const { app } = require('@azure/functions');

function buildFallbackExplanation(ex) {
  const expectedER = Number(ex.expectedER || 0);
  const expectedEE = Number(ex.expectedEE || 0);
  const receivedER = Number(ex.receivedER || 0);
  const receivedEE = Number(ex.receivedEE || 0);
  const diffER = +(expectedER - receivedER).toFixed(2);
  const diffEE = +(expectedEE - receivedEE).toFixed(2);

  const issue = ex.issueType || 'Mismatch';
  const id = ex.empId || 'N/A';
  const period = ex.period || 'N/A';
  const cause = issue === 'Missing'
    ? 'likely missing trustee record or late file ingestion'
    : 'likely payroll/trustee mapping mismatch or contribution calculation variance';
  const action = diffER > 0 || diffEE > 0
    ? `contact employer and trustee to reconcile underpayment (ER ${diffER}, EE ${diffEE})`
    : 'review source payroll and trustee files for this employee and period';

  return `Employee ${id} for period ${period} is flagged as ${issue}. Expected ER/EE is ${expectedER}/${expectedEE}, while received ER/EE is ${receivedER}/${receivedEE}. The likely operations cause is ${cause}. Next action: ${action}.`;
}

app.http('explain', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'explain',
  handler: async (request) => {
    try {
      const body = await request.json();
      const ex = body.exception || {};
      const explanation = buildFallbackExplanation(ex);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ explanation })
      };
    } catch (_err) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid request payload for explain.' })
      };
    }
  }
});
