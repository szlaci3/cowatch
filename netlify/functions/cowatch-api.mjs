import { handleApi } from "../../api.mjs";

export default function handler(request) {
  return handleApi(request);
}

export const config = { path: ["/api/live", "/api/search"] };
