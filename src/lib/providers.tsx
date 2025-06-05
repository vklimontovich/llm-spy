'use client'

import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {useState} from 'react'
import {AntdRegistry} from "@ant-design/nextjs-registry";
import {ConfigProvider} from "antd";
import {SessionProvider} from "next-auth/react";

export function RootProviders({children}: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 60 * 1000, // 1 minute
                        refetchOnWindowFocus: false,
                    },
                },
            })
    )

    return (
        <SessionProvider>
            <QueryClientProvider client={queryClient}>
                <AntdRegistry>
                    <ConfigProvider>
                        {children}
                    </ConfigProvider>
                </AntdRegistry>
            </QueryClientProvider>
        </SessionProvider>
    )
}