import requests
url='https://salmon-smoke-05d320f1e.6.azurestaticapps.net/api/reconcile'
payload={'payroll':[{'EmpId':'E001','EmpName':'Alice Chen','Period':'2026-03','ExpectedER':1200.0,'ExpectedEE':600.0}], 'trustee':[{'EmpId':'E001','Period':'2026-03','ReceivedER':1200.0,'ReceivedEE':600.0}]}
r=requests.post(url,json=payload,headers={'Content-Type':'application/json'})
print('status', r.status_code)
print(r.text)
