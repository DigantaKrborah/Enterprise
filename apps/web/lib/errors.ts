import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVER_ERROR";

export function apiError(message: string, status: number, code: ApiErrorCode): NextResponse {
  return NextResponse.json({ error: { message, code } }, { status });
}

export const unauthorized = () => apiError("Authentication required", 401, "UNAUTHORIZED");
export const forbidden    = () => apiError("Insufficient permissions", 403, "FORBIDDEN");
export const notFound     = (r = "Resource") => apiError(`${r} not found`, 404, "NOT_FOUND");
export const badRequest   = (msg: string) => apiError(msg, 400, "BAD_REQUEST");
export const conflict     = (msg: string) => apiError(msg, 409, "CONFLICT");
export const rateLimited  = () => apiError("Too many requests — try again shortly", 429, "RATE_LIMITED");
export const serverError  = (msg = "Internal server error") => apiError(msg, 500, "SERVER_ERROR");
