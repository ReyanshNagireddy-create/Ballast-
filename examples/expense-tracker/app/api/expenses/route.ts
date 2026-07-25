import { NextResponse } from "next/server";
import { db } from "../../../lib/db";

export async function GET() {
  const rows = await db.expense.findMany({ take: 500 });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const created = await db.expense.create({ data: body });
  return NextResponse.json(created, { status: 201 });
}
