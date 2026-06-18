#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createCommonAdminMcpServer } from "./index.js";

const server = createCommonAdminMcpServer();
await server.connect(new StdioServerTransport());
