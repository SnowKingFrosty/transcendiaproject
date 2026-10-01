import { NextResponse } from "next/server"

// Serves the Firebase web config to the static index.html page.
// The apiKey is read from the project environment variable so it is not
// hardcoded in the committed HTML. Firebase web API keys are safe to expose
// to the client; access is enforced by Firestore security rules.
export async function GET() {
  return NextResponse.json({
    apiKey: process.env.apiKey,
    authDomain: "transcendia-4f714.firebaseapp.com",
    projectId: "transcendia-4f714",
    storageBucket: "transcendia-4f714.firebasestorage.app",
    messagingSenderId: "1005918946235",
    appId: "1:1005918946235:web:d02fc7910b37e5e531ba9e",
  })
}
