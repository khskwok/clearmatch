import requests
url='https://salmon-smoke-05d320f1e.6.azurestaticapps.net/api/explain'
payload={'exception':{'empId':'E002','empName':'Bob Lee','period':'2026-03','expectedER':1100,'expectedEE':550,'receivedER':1050,'receivedEE':550,'issueType':'Underpay','reasonCode':'UNDERPAY'}}
r=requests.post(url,json=payload,headers={'Content-Type':'application/json'})
print('status', r.status_code)
print(r.text)
