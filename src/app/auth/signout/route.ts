import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
    const supabase = await createClient()

    // Check if a user's logged in
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (user) {
        await supabase.auth.signOut()
    }

    revalidatePath('/', 'layout')

    // Create the response with redirect
    const response = NextResponse.redirect(new URL('/login', req.url), {
        status: 302,
    })

    // Manually expire all Supabase-related cookies
    const allCookies = req.cookies.getAll();
    allCookies.forEach(cookie => {
        if (cookie.name.startsWith('sb-') && cookie.name.endsWith('-auth-token')) {
            response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 });
            response.cookies.delete(cookie.name);
        }
    });

    return response
}
