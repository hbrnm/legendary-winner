import { createCspReportHandler } from "./core.js";

declare const Deno: {
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

Deno.serve(createCspReportHandler());
