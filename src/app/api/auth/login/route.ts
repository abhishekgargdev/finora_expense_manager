import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connect from "../../../../lib/db";
import UserModel from "../../../../models/User";
import { signSession, COOKIE_NAME } from "../../../../lib/auth";

await connect();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    const user = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    if (!user) {
      // small delay to slow brute-force and avoid revealing existence
      await new Promise((r) => setTimeout(r, 450));
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, (user as any).password);
    if (!ok) {
      await new Promise((r) => setTimeout(r, 450));
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await signSession({ userId: user._id.toString(), email: user.email });

    const res = NextResponse.json({ success: true, user: { name: user.name, email: user.email } });
    res.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
}
