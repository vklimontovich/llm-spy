import { ImageResponse } from 'next/og'
import { copy } from '@/lib/copy'

export const runtime = 'edge'

export async function GET() {
  try {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            position: 'relative',
          }}
        >
          {/* Background pattern */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.1) 2%, transparent 0%)`,
              backgroundSize: '50px 50px',
            }}
          />

          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '40px',
              zIndex: 10,
            }}
          >
            {/* Logo/Brand */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '30px',
              }}
            >
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  background: 'white',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '20px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#667eea"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
              </div>
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: '800',
                  color: 'white',
                  letterSpacing: '-1px',
                }}
              >
                {copy.brand.name}
              </div>
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: '72px',
                fontWeight: '800',
                color: 'white',
                marginBottom: '20px',
                lineHeight: 1.1,
                letterSpacing: '-2px',
                maxWidth: '900px',
              }}
            >
              {copy.hero.title}
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontSize: '28px',
                color: 'rgba(255, 255, 255, 0.9)',
                marginBottom: '40px',
                maxWidth: '800px',
                lineHeight: 1.4,
              }}
            >
              {copy.hero.subtitle}
            </p>

            {/* Features */}
            <div
              style={{
                display: 'flex',
                gap: '40px',
                marginTop: '20px',
              }}
            >
              {[
                'Universal Gateway',
                'Session Intelligence',
                'Real-time Monitoring',
              ].map(feature => (
                <div
                  key={feature}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      background: 'rgba(255, 255, 255, 0.3)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span
                    style={{
                      fontSize: '20px',
                      color: 'rgba(255, 255, 255, 0.95)',
                      fontWeight: '600',
                    }}
                  >
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom decoration */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '8px',
            }}
          >
            {[1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  width: i === 2 ? '32px' : '8px',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '4px',
                }}
              />
            ))}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (e: any) {
    console.log(`${e.message}`)
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}
