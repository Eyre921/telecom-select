import {NextResponse} from 'next/server';

// This is a simple health-check endpoint.
// It has no external dependencies.

export async function GET() {
    return NextResponse.json({message: 'API is working correctly!'});
}
