const { app } = require('@azure/functions');

// Simple HK MPF-style reconciliation logic
app.http('reconcile', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'reconcile',
  handler: async (request, context) => {
    try {
      const body = await request.json();
      const payroll = body.payroll || [];
      const trustee = body.trustee || [];

      // Index trustee rows by EmpId+Period
      const trusteeMap = new Map();
      for (const row of trustee) {
        const empId = row.EmpId || row.empId;
        const period = row.Period || row.period;
        if (!empId || !period) continue;
        const key = `${empId}|${period}`;
        trusteeMap.set(key, row);
      }

      const exceptions = [];
      let matched = 0;

      for (const row of payroll) {
        const empId = row.EmpId || row.empId;
        const period = row.Period || row.period;
        const empName = row.EmpName || row.empName;

        const expectedER = Number(row.ExpectedER || row.expectedER || 0);
        const expectedEE = Number(row.ExpectedEE || row.expectedEE || 0);

        const key = `${empId}|${period}`;
        const t = trusteeMap.get(key);

        if (!t) {
          exceptions.push({
            empId,
            empName,
            period,
            expectedER,
            expectedEE,
            receivedER: 0,
            receivedEE: 0,
            issueType: 'Missing',
            status: 'Exception',
            reasonCode: 'NO_TRUSTEE_RECORD'
          });
          continue;
        }

        const receivedER = Number(t.ReceivedER || t.receivedER || 0);
        const receivedEE = Number(t.ReceivedEE || t.receivedEE || 0);

        const tol = 0.01; // tolerance
        const erDiff = receivedER - expectedER;
        const eeDiff = receivedEE - expectedEE;

        let issueType = 'Matched';
        let reasonCode = 'OK';

        const erOk = Math.abs(erDiff) <= tol;
        const eeOk = Math.abs(eeDiff) <= tol;

        if (erOk && eeOk) {
          matched++;
        } else {
          if (erDiff < -tol || eeDiff < -tol) {
            issueType = 'Underpay';
            reasonCode = 'UNDERPAY';
          } else if (erDiff > tol || eeDiff > tol) {
            issueType = 'Overpay';
            reasonCode = 'OVERPAY';
          } else {
            issueType = 'Mismatch';
            reasonCode = 'MISMATCH';
          }

          exceptions.push({
            empId,
            empName,
            period,
            expectedER,
            expectedEE,
            receivedER,
            receivedEE,
            issueType,
            status: 'Exception',
            reasonCode
          });
        }
      }

      const totalEmployees = payroll.length;
      const matchRate = totalEmployees ? matched / totalEmployees : 0;

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalEmployees, matchRate, exceptions })
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
