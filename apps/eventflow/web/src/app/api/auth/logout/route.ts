import { logoutUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  await logoutUser();
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  await logoutUser();
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}
