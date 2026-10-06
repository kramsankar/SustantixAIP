import { ApiError, parseJson, readBody } from "../http";

/** Reads a JSON request body under a byte ceiling. */
export async function jsonBody(req: Request, limit: number): Promise<unknown> {
  try {
    return parseJson(await readBody(req, limit));
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "invalid_json", "request body is not JSON");
  }
}
