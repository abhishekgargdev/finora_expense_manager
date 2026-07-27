import { NextResponse } from "next/server";
import connect from "../../../../lib/db";
import UserModel from "../../../../models/User";
import { getSession } from "../../../../lib/auth";

await connect();

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 200 });

  try {
    const user = await UserModel.findById(session.userId).lean();
    if (!user) return NextResponse.json({ user: null }, { status: 200 });
    return NextResponse.json({ user: { name: user.name, email: user.email } });
  } catch (err) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
