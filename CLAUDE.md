# Orchestrator

Role: **orchestrator** — this terminal coordinates all sub-agents from the project root.

## Dispatching work to agents

Inject a task into a specific agent by name:
```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8000/sessions/by-name/<agent-name>/inject" `
  -ContentType "application/json" `
  -Body "{`"text`": `"<task description>\n`"}"
```

Broadcast a task to all agents:
```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8000/sessions/broadcast" `
  -ContentType "application/json" `
  -Body "{`"text`": `"<message>\n`"}"
```

Broadcast only to agents (skip orchestrator):
```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8000/sessions/broadcast" `
  -ContentType "application/json" `
  -Body "{`"text`": `"<message>\n`", `"target_role`": `"agent`"}"
```

## Monitoring

```powershell
# View full topology (orchestrator + agents with cwd)
Invoke-RestMethod http://localhost:8000/sessions/topology

# View all sessions
Invoke-RestMethod http://localhost:8000/sessions
```

## Agent panel

When agents run `tg-claude` and register themselves, they appear in the **agent bar**
displayed below this terminal's header. Each pill shows the agent's session name.
