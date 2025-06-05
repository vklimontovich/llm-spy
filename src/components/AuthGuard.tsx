'use client'

import {SessionProvider, useSession} from 'next-auth/react'
import {useRouter, usePathname} from 'next/navigation'
import {useEffect, useState} from 'react'

export default function AuthGuard({children}: { children: React.ReactNode }) {
    return <SessionProvider>
        <AuthGuard0>
            {children}
        </AuthGuard0>
    </SessionProvider>
}

function AuthGuard0({children}: { children: React.ReactNode }) {
    const session = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const [redirect, setRedirect] = useState<string>();
    console.log("pathname", pathname)

    useEffect(() => {
        if (session.status === 'loading') {
            return
        } else if (session.status === 'unauthenticated') {
            if (pathname.startsWith("/api/auth")) {
                // If we're already on an auth page, don't redirect
                return
            }
            const signinPage = "/api/auth/signin";
            setRedirect(signinPage);
            router.push(signinPage)
        } else if (session.status === 'authenticated') {
            //do nothing, session is available
        } else {
            throw new Error("Unexpected session status: " + session.status)
        }
    }, [session.status, router, pathname])

    if (session.status === 'loading' || redirect) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">{redirect ? 'Redirectig...' : 'Loading...'}</div>
            </div>
        )
    } else {
        return <>{children}</>
    }
}