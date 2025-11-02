import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

/**
 * Admin-only endpoint to create new users
 * Requires ADMIN_SECRET in x-admin-secret header
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin secret
    const adminSecret = request.headers.get("x-admin-secret");
    if (!adminSecret || adminSecret !== env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid admin secret." },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, password, name } = body;

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, name" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Create user using Better Auth
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
      headers: new Headers({ "x-admin-secret": env.ADMIN_SECRET }),
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || "Failed to create user" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: result.data?.user?.id,
        email: result.data?.user?.email,
        name: result.data?.user?.name,
      },
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
