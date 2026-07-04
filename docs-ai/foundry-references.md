# Referências Externas (Foundry VTT)

Os repositórios abaixo são referências técnicas permanentes para arquitetura, padrões de Foundry VTT, sheets, actors, items, data models, compêndios, templates, hooks, sockets, manifestos e build.

- https://github.com/foundryvtt/foundryvtt — core do Foundry VTT
- https://github.com/foundryvtt/dnd5e — sistema D&D 5e (referência de padrões de sheets/data models maduros)
- https://github.com/Foundryborne/daggerheart — sistema Daggerheart (referência de sheets enxutas e modernas)
- https://github.com/burobrasil/olddragon2e-foundryvtt — sistema Old Dragon 2E (referência pt-BR)
- https://github.com/foundryvtt/foundryvtt-cli — CLI usado para compilar compêndios (`@foundryvtt/foundryvtt-cli`, `compilePack`)
- https://github.com/foundryvtt/pf2e — sistema Pathfinder 2e (referência de organização modular e JSDoc)

## Como usar

- Use **apenas como referência técnica** de arquitetura, padrões de Foundry VTT (ApplicationV2, DataModel, hooks, sockets, etc.), organização de sheets/templates/compêndios e fluxo de build.
- **Não copie código diretamente desses repositórios.** Adapte ideias e padrões ao estilo e às convenções já existentes no Cardigan (ver [project-conventions.md](project-conventions.md) e [architecture.md](architecture.md)).
- Útil principalmente ao planejar refatorações grandes (ver [pending-tasks.md](pending-tasks.md)), onde comparações com esses sistemas já foram usadas para embasar propostas.
