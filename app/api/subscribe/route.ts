import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json();
  console.log(`Received subscription request for email: ${email}`);

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    // Create a email account
    const { data, error: dataErr } = await resend.contacts.create({
      email,
      firstName: "ZaG",
      lastName: "Cool",
    });
    if (dataErr) {
      return NextResponse.json(
        { message: `Failed to subscribe with email: ${email}`, error: dataErr },
        { status: 500 },
      );
    }
    // add the contact to a list
    const { error: segmentErr } = await resend.contacts.segments.add({
      email,
      segmentId: "2afb601d-4f1c-4269-8a0b-77c465ab3569",
    });
    if (segmentErr) {
      return NextResponse.json(
        {
          message: `Failed to add contact to segment: ${email}`,
          error: segmentErr,
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { message: `Successfully subscribed with email: ${email}`, data },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { message: `Failed to subscribe with email: ${email}` },
      { status: 500 },
    );
  }
}
