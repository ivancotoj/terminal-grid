# Frontend Agent

Role: **agent** — this terminal manages frontend changes (React/TypeScript).

## Notifying other agents

Inject a prompt into the backend agent:
```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8000/sessions/by-name/backend/inject" `
  -ContentType "application/json" `
  -Body "{`"text`": `"<instructions>\n`"}"
```

Broadcast to all agents:
```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8000/sessions/broadcast" `
  -ContentType "application/json" `
  -Body "{`"text`": `"<message>\n`"}"
```

## Useful commands

```powershell
# See all registered sessions
Invoke-RestMethod http://localhost:8000/sessions

# See orchestrator + agent topology
Invoke-RestMethod http://localhost:8000/sessions/topology
```
